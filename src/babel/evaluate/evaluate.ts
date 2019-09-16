/* eslint-disable no-ex-assign */
import {
  BabelFileResult,
  PluginItem,
  TransformOptions,
  loadPartialConfig,
  createConfigItem,
  PartialConfig,
  ConfigItem,
  NodePath,
  parseSync,
  transformFromAstSync,
} from '@babel/core';
import generator from '@babel/generator';

import Module, { makeModule } from '../module';
import fs from 'fs';
import { StrictOptions } from '../types';
import debug from 'debug';
import slugify from '../../utils/slugify';
import fixError from '../utils/fixError';
import * as compileCache from '../compileCache';

// Load compile cache here.
let cache = compileCache.get();

const log = debug('linaria:evaluate');

interface TOptions extends TransformOptions {
  caller: {
    name: string;
    evaluate?: boolean;
  };
}

type DefaultOptions = Partial<TOptions> & {
  plugins: PluginItem[];
  presets: PluginItem[];
};

const babelPreset = require.resolve('../index');
const topLevelBabelPreset = require.resolve('../../../babel');
const dynamicImportNOOP = require.resolve('../dynamic-import-noop');

function mtime(filename: string) {
  try {
    return +fs.statSync(filename).mtime;
  } catch (e) {
    return Date.now();
  }
}

export default function evaluate(
  codeOrPath: string | NodePath,
  filename: string,
  options?: StrictOptions
) {
  const m = makeModule(filename);
  m.dependencies = [];

  m.transform = function transform(this: Module, { code, map }) {
    if (
      (options && options.ignore && options.ignore.test(this.filename)) ||
      code.includes('__esModule') // assume it is already transformed
    ) {
      log(`skipping transform for ${this.filename}. ignored.`);
      return { code, map };
    }

    // If we have already run linaria on this file,
    // there is no need to repeat the process on the shaken file.
    const includeLinariaPass = !code.includes('__linariaPreval');

    let transformOptions;
    try {
      transformOptions = getOptions(options, this.filename, map);
      this._cacheKey = slugify(JSON.stringify(transformOptions));
    } catch (e) {
      e = fixError(e);
      e.stack =
        'Linaria Preval Config Error: Could not load Babel options. Check your Babel config file.\n' +
        e.stack;
      throw e;
    }

    // compile cache
    const lastModified = mtime(this.filename);
    let cached = cache[this.filename];
    if (
      cached &&
      cached.optsHash === this._cacheKey &&
      cached.mtime === lastModified
    ) {
      return {
        code: cached.code,
        map: cache[this.filename].map,
      };
    }

    try {
      let ast = parseSync(code, transformOptions)!;
      if (includeLinariaPass) {
        log(`transform step 1: linaria pass for ${this.filename}`);
        /**
         * We need to perform this transform first. This two-pass approach ensures that
         * path.evaluate() will not return different results from different Babel configs.
         */
        const { map: map2, ast: ast2 } = transformFromAstSync(ast!, code, {
          filename: this.filename,
          presets: [[babelPreset, { ...options, _isEvaluatePass: true }]],
          babelrc: false,
          configFile: false,
          sourceMaps: true,
          sourceFileName: this.filename,
          inputSourceMap: map == null ? undefined : map,
          code: false,
          ast: true,
        })!;
        ast = ast2!;
        map = map2 == undefined ? null : map2;
      } else {
        log(`transform step 1: linaria skipped pass for ${this.filename}`);
      }
      log(`transform step 2: babel pass for ${this.filename}`);
      const compiled = transformFromAstSync(
        ast,
        code,
        transformOptions
      ) as BabelFileResult;
      cache[this.filename] = {
        code: compiled.code!,
        map: compiled.map!,
        optsHash: this._cacheKey,
        mtime: lastModified,
        meta: {
          linariaPass: includeLinariaPass,
        },
      };
      return compiled;
    } catch (e) {
      e = fixError(e);
      e.stack = `Linaria Preval Transform Error:\n${
        !e.stack.includes(this.filename)
          ? `Error encountered while processing ${this.filename}\n`
          : ''
      }${e.stack}`;
      throw e;
    }
  };

  if (typeof codeOrPath !== 'string') {
    const generated = generator(
      codeOrPath.node,
      {
        filename,
        sourceMaps: true,
        sourceFileName: filename,
      },
      codeOrPath.getSource()
    );
    m.evaluate(generated);
  } else {
    m.evaluate({ code: codeOrPath, map: null });
  }

  return {
    value: m.exports,
    dependencies: m.dependencies,
  };
}

function getPresetName(item: any): string {
  return Array.isArray(item) ? item[0] : item;
}

/**
 * builds Babel config for file.
 * 1. Plugins run before Presets.
 * 2. Plugins run first to last.
 * 3. Presets run last to first.
 */
function getOptions(
  pluginOptions: StrictOptions | undefined,
  filename: string,
  map: any
): TransformOptions {
  const transformOptions = getProgramaticOptions(pluginOptions);
  transformOptions.filename = filename;
  const { options } = loadPartialConfig(transformOptions) as Readonly<
    PartialConfig
  >;
  // We override the preset-env if it was specified to target Node only.
  const presetEnvIndex = options.presets!.findIndex(item => {
    return (
      (item as ConfigItem).file &&
      (item as ConfigItem).file!.request === '@babel/preset-env'
    );
  });
  if (presetEnvIndex !== -1) {
    const presetEnv = options!.presets![presetEnvIndex] as ConfigItem;
    const nextOptions = {
      ...presetEnv.options,
      targets: { node: 'current' },
    } as any;
    options.presets![presetEnvIndex] = createConfigItem([
      presetEnv.value,
      nextOptions,
    ]);
  }
  options.inputSourceMap = map == null ? undefined : map;
  options.sourceMaps = true;
  options.ast = false;

  return options;
}

let programaticOptionsCached: TransformOptions;

/**
 * Build the programatic Babel options. These do not change file-to-file so we can cache this work.
 */
function getProgramaticOptions(
  pluginOptions: StrictOptions | undefined
): TransformOptions {
  if (programaticOptionsCached) {
    return programaticOptionsCached;
  }
  const plugins: (string | [string, any])[] = [
    // Include these plugins to avoid extra config when using { module: false } for webpack
    ['@babel/plugin-transform-modules-commonjs', { loose: true }],
    '@babel/plugin-proposal-export-namespace-from',
  ];
  const defaults: DefaultOptions = {
    caller: {
      name: '@brandonkal/linaria',
      evaluate: true,
    },
    sourceMaps: true,
    presets: [],
    plugins: [
      ...plugins.map(name => require.resolve(getPresetName(name))),
      // We don't support dynamic imports when evaluating, but don't want a syntax error
      // This will replace dynamic imports with an object that does nothing
      dynamicImportNOOP,
    ],
  };
  const babelOptions =
    // Shallow copy the babel options because we mutate it later
    pluginOptions && pluginOptions.babelOptions
      ? { ...pluginOptions.babelOptions }
      : {};
  // If we programatically pass babel options while there is a .babelrc, babel might throw
  // We need to filter out duplicate presets and plugins so that this doesn't happen
  // This workaround isn't foolproof, but it's still better than nothing
  const keys: Array<keyof TransformOptions & ('presets' | 'plugins')> = [
    'presets',
    'plugins',
  ];
  keys.forEach(field => {
    babelOptions[field] = babelOptions[field]
      ? babelOptions[field]!.filter((item: PluginItem) => {
          // If item is an array it's a preset/plugin with options ([preset, options])
          // Get the first item to get the preset.plugin name
          // Otherwise it's a plugin name (can be a function too)
          const name = getPresetName(item);
          if (
            // In our case, a preset might also be referring to linaria/babel
            // We require the file from internal path which is not the same one that we export
            // This case won't get caught and the preset won't be filtered, even if they are same
            // So we add an extra check for top level linaria/babel
            name === '@brandonkal/linaria/babel' ||
            name === topLevelBabelPreset ||
            name === babelPreset ||
            // Also add a check for the plugin names we include for bundler support
            (typeof name === 'string' &&
              plugins.map(p => getPresetName(p).includes(name)))
          ) {
            return false;
          }
          // Loop through the default presets/plugins to see if it already exists
          return !defaults[field].some(
            it =>
              // The default presets/plugins can also have nested arrays,
              getPresetName(it) === name
          );
        })
      : [];
  });
  const transformOptions = {
    // Passed options shouldn't be able to override the options we pass
    // Linaria's plugins rely on these (such as filename to generate consistent hash)
    ...babelOptions,
    ...defaults,
    presets: [
      // Preset order is last to first, so add the extra presets to start
      // This makes sure that our preset is always run first
      ...babelOptions.presets!,
      ...defaults.presets,
    ],
    plugins: [
      ...defaults.plugins,
      // Plugin order is first to last, so add the extra plugins to end
      // This makes sure that the plugins we specify always run first
      ...babelOptions.plugins!,
    ],
  };
  programaticOptionsCached = transformOptions;
  return programaticOptionsCached;
}
