import path from 'path';
import * as babel from '@babel/core';
import { SourceMapGenerator } from 'source-map';
import loadOptions, { PluginOptions } from './loadOptions';
import debug from 'debug';
import { Rules, Replacement, CSSIdentifiers } from '../babel/types';
import * as compileCache from '../babel/compileCache';
const log = debug('linaria:loader');

type Result = {
  code: string;
  sourceMap: Object | null | undefined;
  cssText?: string;
  cssSourceMapText?: string;
  dependencies?: string[];
  rules?: Rules;
  replacements?: Replacement[];
  identifiers?: CSSIdentifiers;
};

type Options = {
  filename: string;
  outputFilename?: string;
  inputSourceMap?: Object;
  /** Where the transform cache is stored */
  cacheDirectory?: string;
  pluginOptions?: Partial<PluginOptions>;
};

const babelPreset = require.resolve('../babel');

let COMPILE_CACHE_LOADED = false;

export default function transform(code: string, options: Options): Result {
  // Check if the file contains `css`, `styled`, or injectGlobal words first
  // Otherwise we should skip transforming
  if (
    !(
      /\b(styled|css|injectGlobal)/.test(code) &&
      code.includes('@brandonkal/linaria')
    )
  ) {
    log(`skipping ${options.filename}: linaria usage not found`);
    return {
      code,
      sourceMap: options.inputSourceMap,
    };
  }

  // Warm the compileCache
  if (!COMPILE_CACHE_LOADED) {
    compileCache.load(options.cacheDirectory);
    COMPILE_CACHE_LOADED = true;
  }

  const pluginOptions = loadOptions(options.pluginOptions);

  log(`parsing ${options.filename}`);

  // Parse the code first so babel uses user's babel config for parsing
  // We don't want to use user's config when transforming the code
  const ast = babel.parseSync(code, {
    ...(pluginOptions && pluginOptions.babelOptions),
    filename: options.filename,
    caller: { name: '@brandonkal/linaria' },
  });

  log(`transforming ${options.filename}`);

  const { metadata, code: transformedCode, map } = babel.transformFromAstSync(
    ast!,
    code,
    {
      filename: options.filename,
      presets: [[babelPreset, pluginOptions]],
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      sourceFileName: options.filename,
      inputSourceMap: options.inputSourceMap,
    }
  )!;

  log(`transform complete ${options.filename}`);

  if (!metadata || !metadata.linaria) {
    return {
      code,
      sourceMap: options.inputSourceMap,
    };
  }

  let { replacements, dependencies, cssText } = metadata.linaria;

  // Construct a CSS-ish file from the unprocessed style rules

  // When writing to a file, we need to adjust the relative paths inside url(..) expressions
  // It'll allow css-loader to resolve an imported asset properly
  if (options.outputFilename) {
    cssText = cssText.replace(
      /\b(url\()(\.[^)]+)(\))/g,
      (_, p1, p2, p3) =>
        p1 +
        // Replace asset path with new path relative to the output CSS
        path.relative(
          path.dirname(options.outputFilename!),
          // Get the absolute path to the asset from the path relative to the JS file
          path.resolve(path.dirname(options.filename), p2)
        ) +
        p3
    );
  }
  cssText += '\n';

  return {
    code: transformedCode || '',
    cssText,
    replacements,
    dependencies,
    sourceMap: map,

    get cssSourceMapText() {
      const generator = new SourceMapGenerator({
        file: options.filename,
      });
      generator.addMapping({
        generated: {
          line: 1,
          column: 0,
        },
        original: {
          line: 1,
          column: 0,
        },
        source: options.filename,
      });
      generator.setSourceContent(options.filename, code);
      return generator.toString();
    },
  };
}
