import { createFilter } from 'rollup-pluginutils';
import transform from './utils/transform';
import slugify from './utils/slugify';
import { StrictOptions } from './babel/types';

interface RollupPluginOptions extends Partial<StrictOptions> {
  include?: string | string[];
  exclude?: string | string[];
  sourceMap?: boolean;
}

export default function linaria({
  include,
  exclude,
  sourceMap,
  ...rest
}: RollupPluginOptions = {}) {
  const filter = createFilter(include, exclude);
  const cssLookup: { [key: string]: string } = {};

  return {
    name: '@brandonkal/linaria',
    load(id: string) {
      return cssLookup[id];
    },
    /* eslint-disable-next-line consistent-return */
    resolveId(importee: string) {
      if (importee in cssLookup) return importee;
    },
    async transform(code: string, id: string) {
      if (!filter(id)) return;

      const result = await transform(code, {
        filename: id,
        pluginOptions: rest,
      });

      if (!result.cssText) return;

      let { cssText } = result;

      const slug = slugify(id);
      const filename = `${id.replace(/\.js$/, '')}_${slug}.css`;

      if (sourceMap && result.cssSourceMap) {
        const map = Buffer.from(JSON.stringify(result.cssSourceMap)).toString(
          'base64'
        );
        cssText +=
          `/*# sourceMappingURL` + `=data:application/json;base64,${map}*/`;
      }

      cssLookup[filename] = cssText;

      result.code += `\nimport ${JSON.stringify(filename)};\n`;

      /* eslint-disable-next-line consistent-return */
      return { code: result.code, map: result.sourceMap };
    },
  };
}
