import fs from 'fs';
import path from 'path';
import normalize from 'normalize-path';
import loaderUtils from 'loader-utils';
import validateOptions from 'schema-utils';
import enhancedResolve from 'enhanced-resolve';
import Module, { clearModules } from './babel/module';
import transform, { Result } from './utils/transform';
import fixError from './babel/utils/fixError';
// eslint-disable-next-line import/no-extraneous-dependencies
import { loader } from 'webpack'; // type only import
import debug from 'debug';
import { RawSourceMap } from 'source-map';
const log = debug('linaria:loader');

const schema = {
  type: 'object',
  properties: {
    displayName: {
      type: 'boolean',
    },
    evaluate: {
      type: 'boolean',
    },
    prefix: {
      type: 'string',
    },
    optimize: {
      type: 'boolean',
    },
    sourceMap: {
      type: 'boolean',
    },
    cacheDirectory: {
      type: 'string',
    },
  },
};

const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];

// Keep track of requested files. We only clear dependents on rebuilds.
const requested = new Set<string>();

export function pitch(this: loader.LoaderContext) {
  if (!requested.has(this.resourcePath)) {
    requested.add(this.resourcePath);
  } else {
    log(`pitch for ${this.resourcePath}. Clearing dependent modules.`);
    // We clear on hot rebuilds.
    // If we could be sure that modules don't execute code in module scope
    // (only export functions) this step could be omitted.
    clearModules(this.resourcePath);
  }
}

let linariaResolver: (id: string, parent: any) => string;

export default async function linariaLoader(
  this: loader.LoaderContext,
  content: string,
  inputSourceMap?: RawSourceMap
) {
  log(`Executing loader for ${this.resourcePath}`);
  const callback = this.async()!;
  // this.cacheable();
  const options = loaderUtils.getOptions(this) || {};
  validateOptions(schema, options, 'Linaria Loader');
  const { sourceMap, cacheDirectory: cacheConfig, ...pluginOptions } = options;
  const cacheName: string = cacheConfig || '.linaria-cache';

  const filePrefix = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

  const cacheDirectory = path.isAbsolute(cacheName)
    ? cacheName
    : path.join(this.rootContext, cacheName);

  const outputFilename = path.join(
    cacheDirectory,
    path.relative(
      this.rootContext,
      this.resourcePath.replace(/\.[^.]+$/, `.${filePrefix}.linaria.css`)
    )
  );

  createResolver.call(this);

  let result: Result;

  const originalResolveFilename = Module._resolveFilename;

  try {
    // Use webpack's resolution when evaluating modules
    Module._resolveFilename = linariaResolver;

    result = await transform(content, {
      filename: this.resourcePath,
      inputSourceMap: inputSourceMap != null ? inputSourceMap : undefined,
      outputFilename,
      pluginOptions,
      cacheDirectory,
    });
  } catch (e) {
    throw fixError(e);
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }

  if (result.cssText) {
    let { cssText } = result;
    // We add a new line here because otherwise an empty string would always be truthy.
    cssText += '\n';

    if (result.dependencies && result.dependencies.length) {
      const deps = result.dependencies.filter(
        dep => !dep.includes('node_modules')
      );
      deps.forEach(dep => {
        try {
          // TODO: Remove this and handle deps in CSS logic.
          this.addDependency(dep);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[linaria] failed to add dependency for: ${dep}`, e);
        }
      });
    }

    const inFS: typeof fs & { mkdirp: (path: string) => void } = this.fs || fs;
    // Read the file first to compare the content
    // Write the new content only if it's changed
    // In development, we compare the contents without the trailing empty lines at the end
    // of the file and sourceMap comment.
    // However, in production, we will always write a new CSS file if the contents differ.
    // This will prevent unnecessary WDS reloads
    let currentCss = '';
    try {
      currentCss = inFS
        .readFileSync(outputFilename, { encoding: 'utf8' })
        .toString();
    } catch (e) {
      // Ignore error
    }

    const { cssOutput, update } = appendSourceMap(
      currentCss,
      cssText,
      JSON.stringify(result.cssSourceMap)
    );

    if (update || 1) {
      // makeDir.sync(path.dirname(outputFilename));
      // const writeFile = util.promisify(fs.writeFile);
      fs.writeFile(outputFilename, cssOutput, { encoding: 'utf8' }, err => {
        log(`done ${this.resourcePath} (write css)`);
        callback(
          null,
          `${result.code}\n\nrequire(${loaderUtils.stringifyRequest(
            this,
            normalize(outputFilename)
          )});`,
          result.sourceMap
        );
      });
    } else {
      // TEMP: duplicate code
      log(`done ${this.resourcePath} (no write css)`);
      callback(
        null,
        `${result.code}\n\nrequire(${loaderUtils.stringifyRequest(
          this,
          normalize(outputFilename)
        )});`,
        result.sourceMap
      );
    }

    // return;
  } else {
    log(`done ${this.resourcePath} (skip css)`);
    callback(null, result.code, result.sourceMap);
  }

  function appendSourceMap(
    currentCssText: string | undefined,
    cssText: string,
    cssSourceMap: string = ''
  ) {
    let update = false;
    if (process.env.NODE_ENV !== 'production') {
      let cssTextTrimmed = cssText;
      let currentCssTrimmed = currentCssText || '';
      if (currentCssText) {
        let re = /\/\*# sourceMappingURL=data:application\/json;base64,.*$/m;
        currentCssTrimmed = currentCssTrimmed.replace(re, '');
        currentCssTrimmed = currentCssTrimmed.trimRight();
        cssTextTrimmed = cssText.replace(/\s*$/, '');
      }
      if (currentCssTrimmed !== cssTextTrimmed) {
        update = true;
        if (sourceMap) {
          cssText +=
            `/*# sourceMappingURL` +
            `=data:application/json;base64,${Buffer.from(cssSourceMap).toString(
              'base64'
            )}*/`;
        }
      }
    } else {
      // Production
      if (sourceMap) {
        cssText +=
          `/*# sourceMappingURL` +
          `=data:application/json;base64,${Buffer.from(cssSourceMap).toString(
            'base64'
          )}*/`;
      }
      if (currentCssText !== cssText) {
        update = true;
      }
    }
    return { cssOutput: cssText, update };
  }
}

let lastCompilation: any;
/**
 * Generates a resolver if required
 */
function createResolver(this: loader.LoaderContext) {
  if (
    typeof linariaResolver !== 'function' ||
    lastCompilation !== this._compilation
  ) {
    const resolveSync = enhancedResolve.create.sync(
      // this.resolveSync and this._compilation are deprecated APIs
      // There is this.resolve, but it's asynchronous
      // This API is used by many loaders/plugins, so we should be safe for a while
      this._compilation && this._compilation.options.resolve
        ? {
            fileSystem: this.fs || fs,
            alias: this._compilation.options.resolve.alias,
            modules: this._compilation.options.resolve.modules,
            extensions: this._compilation.options.resolve.extensions
              ? this._compilation.options.resolve.extensions.filter(
                  (ext: string) => supportedExtensions.includes(ext)
                )
              : supportedExtensions,
          }
        : {
            extensions: supportedExtensions,
            fileSystem: this.fs || fs,
          }
    );
    linariaResolver = (id: string, { filename }) =>
      resolveSync(path.dirname(filename), id);
  }
}
