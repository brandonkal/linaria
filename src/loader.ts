import fs from 'fs';
import path from 'path';
import normalize from 'normalize-path';
import loaderUtils from 'loader-utils';
import validateOptions from 'schema-utils';
import enhancedResolve from 'enhanced-resolve';
import Module, { resetModules, findAllDependents } from './babel/module';
import transform, { Result } from './utils/transform';
import fixError from './babel/utils/fixError';
// eslint-disable-next-line import/no-extraneous-dependencies
import { loader } from 'webpack'; // type only import
import { RawSourceMap } from 'source-map';
import { Virtual } from './plugin';

import debug from 'debug';
import { Replacer, RuleBase } from './babel/types';
import buildCSS from './utils/buildCSS';
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
    // We clear on hot rebuilds.
    // If we could be sure that modules don't execute code in module scope
    // (only export functions) this step could be omitted.
    const deps = findAllDependents(this.resourcePath);
    log(
      `pitch for ${this.resourcePath}. Clearing ${deps.size} dependent modules.`
    );
    resetModules(deps);
    deps.forEach(dep => {
      if (dep === this.resourcePath) return;
      const updater = cssUpdaters.get(dep);
      if (updater) {
        updater.update();
      }
    });
  }
}

/**
 * Keep track of CSS. This allows hot reloading of CSS seperately from JS.
 */
const cssUpdaters = new Map<string, CSSUpdater>();

let linariaResolver: (id: string, parent: any) => string;

export default async function linariaLoader(
  this: loader.LoaderContext,
  content: string,
  inputSourceMap?: RawSourceMap
) {
  log(`Executing loader for ${this.resourcePath}`);
  const callback = this.async()!;
  this.cacheable();
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

  try {
    // Use webpack's resolution when evaluating modules
    Module._resolveFilename = linariaResolver;

    result = await transform(content, {
      filename: this.resourcePath,
      inputSourceMap: inputSourceMap != null ? inputSourceMap : undefined,
      cssOutputFilename: outputFilename,
      pluginOptions,
      cacheDirectory,
    });
  } catch (e) {
    throw fixError(e);
  }

  if (result.cssText) {
    let { cssText, cssSourceMap, replacer, rules } = result;
    updateCSS(cssText, outputFilename, cssSourceMap, sourceMap, this.fs);
    callback(
      null,
      `${
        result.code
      }\n\n// Injected by Linaria Loader for Webpack Compilation (virtual)\nrequire(${loaderUtils.stringifyRequest(
        this,
        normalize(outputFilename)
      )});`,
      result.sourceMap
    );
    const cssWriter = (css: string) =>
      updateCSS(css, outputFilename, cssSourceMap, sourceMap, this.fs);
    const updater = new CSSUpdater(
      outputFilename,
      rules!,
      replacer!,
      cssWriter
    );
    cssUpdaters.set(outputFilename, updater);
  } else {
    log(`done ${this.resourcePath} (skip css)`);
    callback(null, result.code, result.sourceMap);
  }
}

class CSSUpdater {
  update: () => void;
  rules: RuleBase[];
  filename: string;
  constructor(
    cssFilename: string,
    rules: RuleBase[],
    replacer: Replacer,
    cssWriter: (css: string) => void
  ) {
    this.rules = rules;
    this.filename = cssFilename;
    this.update = () => {
      log(`Rebuilding CSS for ${this.filename}`);
      const css = buildCSS(this.rules, replacer);
      cssWriter(css);
    };
  }
}

interface reqFS {
  readFileSync: typeof fs.readFileSync;
}

/**
 * updateCSS checks the current CSS file on the filesystem
 * and checks if CSS should be written. If a CSS write is required,
 * a source map is appended and a virtual Module is written.
 * @returns the written CSS text.
 */
function updateCSS(
  cssText: string,
  outputFilename: string,
  cssSourceMap?: RawSourceMap,
  enableSourceMap?: boolean,
  FS?: reqFS
): string {
  // We add a new line here because otherwise an empty string would always be truthy.
  cssText += '\n';
  const inFS = FS || fs;
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
  function appendSourceMap() {
    let update = false;
    let re = /\/\*# sourceMappingURL=data:application\/json;base64,.*$/m;
    const trimmed = (str: string) => {
      return str
        .replace(re, '')
        .trimRight()
        .replace(/\s*$/, '');
    };

    if (process.env.NODE_ENV !== 'production') {
      if (trimmed(currentCss) !== trimmed(cssText)) {
        update = true;
        if (enableSourceMap) {
          cssText +=
            `/*# sourceMappingURL` +
            `=data:application/json;base64,${Buffer.from(
              JSON.stringify(cssSourceMap || '')
            ).toString('base64')}*/`;
        }
      }
    } else {
      // Production
      if (enableSourceMap) {
        cssText +=
          `/*# sourceMappingURL` +
          `=data:application/json;base64,${Buffer.from(
            JSON.stringify(cssSourceMap || '')
          ).toString('base64')}*/`;
      }
    }
    if (currentCss !== cssText) {
      update = true;
    }
    return { cssOutput: cssText, update };
  }
  const { cssOutput, update } = appendSourceMap();
  if (update) {
    log(`updating css file: ${outputFilename}`);
    Virtual.writeModule(outputFilename, cssOutput);
  } else {
    log(`done ${outputFilename} (no css update)`);
  }
  return cssText;
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
