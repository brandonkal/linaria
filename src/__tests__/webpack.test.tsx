import compiler from './__utils__/compiler';
import rimraf from 'rimraf';
import path from 'path';
import Module from '../babel/module';

describe('webpack test', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, '__fixtures__/project/.linaria-cache'));
    Module.invalidateAll();
  });

  test(
    'project compiles -- optimizer',
    async () => {
      const FILE = 'project.tsx';
      const stats = await compiler({
        fixture: FILE,
        folder: 'project',
        production: true,
        complex: true,
        optimize: true,
      });
      const modules: any[] = stats.toJson().modules;
      let js = modules.find(v => v.name.includes(FILE));
      if (js.modules && js.modules.length) {
        js = js.modules.find(v => v.name.includes(FILE));
      }
      const jsSrc = js.source;
      const bundle: string = stats.compilation.assets['bundle.js'].source();
      const css: string = stats.compilation.assets['styles.css'].source();
      expect(css.includes('LINARIA')).toBe(false);
      expect(bundle.includes('LINARIA')).toBe(false);
      const snap =
        '// JS after Babel plugin before optimization\n' +
        jsSrc +
        '\n\n/* CSS after optimization */\n' +
        css;

      expect(snap).toMatchSnapshot();
    },
    3600 * 1000
  );
});
