// TypeScript Version: 3.2

import {
  transformSync,
  BabelFileResult,
  PluginItem,
  TransformOptions,
  types as t,
} from '@babel/core';
import generator from '@babel/generator';
import Module from '../module';
import { StrictOptions } from '../types';

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

export default function evaluate(
  path: t.Node,
  filename: string,
  transformer?: (text: string) => BabelFileResult | null,
  options?: StrictOptions
) {
  const m = new Module(filename);

  m.dependencies = [];
  m.transform =
    typeof transformer !== 'undefined'
      ? transformer
      : function transform(this: Module, text) {
          if (options && options.ignore && options.ignore.test(this.filename)) {
            return { code: text };
          }

          const plugins: Array<string | object> = [
            // Include these plugins to avoid extra config when using { module: false } for webpack
            '@babel/plugin-transform-modules-commonjs',
            '@babel/plugin-proposal-export-namespace-from',
          ];

          const defaults: DefaultOptions = {
            caller: { name: '@brandonkal/linaria', evaluate: true },
            filename: this.filename,
            presets: [[require.resolve('../index'), options]],
            plugins: [
              ...plugins.map(name => require.resolve(name as string)),
              // We don't support dynamic imports when evaluating, but don't wanna syntax error
              // This will replace dynamic imports with an object that does nothing
              require.resolve('../dynamic-import-noop'),
            ],
          };

          const babelOptions =
            // Shallow copy the babel options because we mutate it later
            options && options.babelOptions ? { ...options.babelOptions } : {};

          // If we programmtically pass babel options while there is a .babelrc, babel might throw
          // We need to filter out duplicate presets and plugins so that this doesn't happen
          // This workaround isn't full proof, but it's still better than nothing
          const keys: Array<
            keyof TransformOptions & ('presets' | 'plugins')
          > = ['presets', 'plugins'];
          keys.forEach(field => {
            babelOptions[field] = babelOptions[field]
              ? babelOptions[field]!.filter((item: PluginItem) => {
                  // If item is an array it's a preset/plugin with options ([preset, options])
                  // Get the first item to get the preset.plugin name
                  // Otheriwse it's a plugin name (can be a function too)
                  const name = Array.isArray(item) ? item[0] : item;

                  if (
                    // In our case, a preset might also be referring to linaria/babel
                    // We require the file from internal path which is not the same one that we export
                    // This case won't get caught and the preset won't filtered, even if they are same
                    // So we add an extra check for top level linaria/babel
                    name === '@brandonkal/linaria/babel' ||
                    name === require.resolve('../../../babel') ||
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

          return transformSync(text, {
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
          });
        };

  const { code } = generator(path);
  m.evaluate(code);

  return {
    value: m.exports,
    dependencies: m.dependencies,
  };
}
