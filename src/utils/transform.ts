import * as babel from '@babel/core';
import { RawSourceMap } from 'source-map';
import { defaultOptions } from './options';
import { RuleBase, Replacement, Replacer, StrictOptions } from '../babel/types';
import * as compileCache from '../babel/compileCache';
import debug from 'debug';
import buildCSS, { adjustRelativePaths, buildCssSourceMap } from './buildCSS';
const log = debug('linaria:transform');

export interface Result {
  code: string;
  /** The sourceMap. Type is RawSourceMap from source-map module. */
  sourceMap?: any;
  cssText?: string;
  cssSourceMap?: RawSourceMap;
  dependencies?: string[];
  rules?: RuleBase[];
  replacements?: Replacement[];
  /** A replacer function for updating CSS placeholders. */
  replacer?: Replacer;
}

export interface Options {
  filename: string;
  cssOutputFilename?: string;
  inputSourceMap?: Object;
  /** Where the transform cache is stored */
  cacheDirectory?: string;
  pluginOptions?: Partial<StrictOptions>;
}

const babelPreset = require.resolve('../babel');

let COMPILE_CACHE_LOADED = false;

export default async function transform(
  code: string,
  options: Options
): Promise<Result> {
  try {
    // Check if the file contains `css`, `styled`, or injectGlobal words first
    // Otherwise we should skip transforming
    if (
      !(
        /\b(styled|css|injectGlobal)/.test(code) &&
        code.includes('@brandonkal/linaria')
      )
    ) {
      log(`skipping ${options.filename}: Linaria usage not found`);
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

    const pluginOptions: StrictOptions = {
      ...defaultOptions,
      ...options.pluginOptions,
    };

    log(`parsing ${options.filename}`);

    // Parse the code first so babel uses user's babel config for parsing
    // We don't want to use user's config when transforming the code
    const ast = await babel.parseAsync(code, {
      ...(pluginOptions && pluginOptions.babelOptions),
      filename: options.filename,
      caller: { name: '@brandonkal/linaria' },
    });

    log(`transforming ${options.filename}`);
    const {
      metadata,
      code: transformedCode,
      map,
    } = (await babel.transformFromAstAsync(ast!, code, {
      filename: options.filename,
      presets: [[babelPreset, pluginOptions]],
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      sourceFileName: options.filename,
      inputSourceMap: options.inputSourceMap,
    }))!;

    log(`transform complete ${options.filename}`);

    if (!metadata || !metadata.linaria) {
      return {
        code,
        sourceMap: options.inputSourceMap,
      };
    }

    let { replacements, dependencies, rules, replacer } = metadata.linaria;

    // Construct a CSS-ish file from the unprocessed style rules
    let cssText = buildCSS(rules, replacer!);

    // When writing to a file, we need to adjust the relative paths inside url(..) expressions
    // It'll allow css-loader to resolve an imported asset properly
    cssText = adjustRelativePaths(
      cssText,
      options.filename,
      options.cssOutputFilename
    );

    return {
      code: transformedCode || '',
      rules,
      replacer,
      cssText,
      replacements,
      dependencies,
      sourceMap: map != null ? map : undefined,

      get cssSourceMap() {
        return buildCssSourceMap(
          options.filename,
          options.cssOutputFilename!,
          code
        );
      },
    };
  } catch (e) {
    return Promise.reject(e);
  }
}
