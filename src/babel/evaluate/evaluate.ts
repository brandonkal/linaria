import {
  transformSync,
  BabelFileResult,
  PluginItem,
  TransformOptions,
  loadPartialConfig,
  createConfigItem,
  PartialConfig,
  ConfigItem,
  transformFromAstSync,
  Node,
} from '@babel/core';
import generator from '@babel/generator';

import Module, { makeModule } from '../module';
import { StrictOptions } from '../types';
import debug from 'debug';
import slugify from '../../utils/slugify';
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

export default function evaluate(
  codeOrNode: string | Node,
  filename: string,
  options?: StrictOptions
) {
  const m = makeModule(filename);
  m.dependencies = [];

  m.transform = function transform(this: Module, text, ast?: Node) {
    if (options && options.ignore && options.ignore.test(this.filename)) {
      log(`skipping transform for ${this.filename}. ignored.`);
      return { code: text };
    }

    // If we have already run linaria on this file,
    // there is no need to repeat the process on the shaken file.
    const removeLinariaPreset = text.includes('__linariaPreval');

    const transformOptions = getOptions(options, this.filename);
    this.cacheKey = slugify(JSON.stringify(transformOptions));
    if (removeLinariaPreset) {
      transformOptions.presets!.pop();
    }

    return ast
      ? (transformFromAstSync(ast, text, transformOptions) as BabelFileResult)
      : (transformSync(text, transformOptions) as BabelFileResult);
  };

  // generate code
  let code: string;
  if (typeof codeOrNode !== 'string') {
    code = generator(codeOrNode).code;
    m.evaluate(code, codeOrNode);
  } else {
    code = codeOrNode;
    m.evaluate(code);
  }

  return {
    value: m.exports,
    dependencies: m.dependencies,
  };
}

function getOptions(
  pluginOptions: StrictOptions | undefined,
  filename: string
) {
  const plugins: Array<string | object> = [
    // Include these plugins to avoid extra config when using { module: false } for webpack
    '@babel/plugin-transform-modules-commonjs',
    '@babel/plugin-proposal-export-namespace-from',
  ];
  const defaults: DefaultOptions = {
    caller: {
      name: '@brandonkal/linaria',
      evaluate: true,
    },
    filename: filename,
    sourceMaps: true, // Required for stack traces
    presets: [[babelPreset, pluginOptions]],
    plugins: [
      ...plugins.map(name => require.resolve(name as string)),
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
          const name = Array.isArray(item) ? item[0] : item;
          if (
            // In our case, a preset might also be referring to linaria/babel
            // We require the file from internal path which is not the same one that we export
            // This case won't get caught and the preset won't be filtered, even if they are same
            // So we add an extra check for top level linaria/babel
            name === '@brandonkal/linaria/babel' ||
            name === topLevelBabelPreset ||
            // Also add a check for the plugin names we include for bundler support
            plugins.includes(name)
          ) {
            return false;
          }
          // Loop through the default presets/plugins to see if it already exists
          return !defaults[field].some(it =>
            // The default presets/plugins can also have nested arrays,
            Array.isArray(it) ? it[0] === name : it === name
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
      // Plugin order is first to last, so add the extra presets to end
      // This makes sure that the plugins we specify always run first
      ...babelOptions.plugins!,
    ],
  };
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
    // @ts-ignore
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

  return options;
}
