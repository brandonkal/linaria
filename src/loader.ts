import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import normalize from 'normalize-path';
import loaderUtils from 'loader-utils';
import validateOptions from 'schema-utils';
import enhancedResolve from 'enhanced-resolve';
import Module from './babel/module';
import transform from './utils/transform';
import fixError from './babel/utils/fixError';

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

export default function loader(
  this: any,
  content: string,
  inputSourceMap: Object | null
) {
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

  const resolveOptions = {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  };

  const resolveSync = enhancedResolve.create.sync(
    // this._compilation is a deprecated API
    // However there seems to be no other way to access webpack's resolver
    // There is this.resolve, but it's asynchronous
    // Another option is to read the webpack.config.js, but it won't work for programmatic usage
    // This API is used by many loaders/plugins, so hope we're safe for a while
    this._compilation && this._compilation.options.resolve
      ? {
          ...resolveOptions,
          alias: this._compilation.options.resolve.alias,
          modules: this._compilation.options.resolve.modules,
        }
      : resolveOptions
  );

  let result;

  const originalResolveFilename = Module._resolveFilename;

  try {
    // Use webpack's resolution when evaluating modules
    Module._resolveFilename = (id, { filename }) =>
      resolveSync(path.dirname(filename), id);

    result = transform(content, {
      filename: this.resourcePath,
      inputSourceMap: inputSourceMap != null ? inputSourceMap : undefined,
      outputFilename,
      pluginOptions,
      cacheDirectory,
    });
  } catch (e) {
    throw fixError(e);
  } finally {
    // Restore original behaviour
    Module._resolveFilename = originalResolveFilename;
  }

  if (result.cssText) {
    let { cssText } = result;
    // We add a new line here because otherwise an empty string would always be truthy.
    cssText += '\n';

    if (result.dependencies && result.dependencies.length) {
      result.dependencies.forEach(dep => {
        try {
          this.addDependency(dep);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[linaria] failed to add dependency for: ${dep}`, e);
        }
      });
    }

    // Read the file first to compare the content
    // Write the new content only if it's changed
    // In development, we compare the contents without the trailing empty lines at the end
    // of the file and sourceMap comment.
    // However, in production, we will always write a new CSS file if the contents differ.
    // This will prevent unnecessary WDS reloads
    let currentCss;
    try {
      currentCss = fs.readFileSync(outputFilename, 'utf-8');
    } catch (e) {
      // Ignore error
    }

    const { cssOutput, update } = appendSourceMap(
      currentCss,
      cssText,
      result.cssSourceMapText
    );

    if (update) {
      mkdirp.sync(path.dirname(outputFilename));
      fs.writeFileSync(outputFilename, cssOutput);
    }

    this.callback(
      null,
      `${result.code}\n\nrequire(${loaderUtils.stringifyRequest(
        this,
        normalize(outputFilename)
      )});`,
      result.sourceMap
    );
    return;
  }

  this.callback(null, result.code, result.sourceMap);

  function appendSourceMap(
    currentCssText: string | undefined,
    cssText: string,
    cssSourceMapText?: string
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
          cssText += `/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
            cssSourceMapText || ''
          ).toString('base64')}*/`;
        }
      }
    } else {
      // Production
      if (sourceMap) {
        cssText += `/*# sourceMappingURL=data:application/json;base64,${Buffer.from(
          cssSourceMapText || ''
        ).toString('base64')}*/`;
      }
      if (currentCssText !== cssText) {
        update = true;
      }
    }
    return { cssOutput: cssText, update };
  }
}
