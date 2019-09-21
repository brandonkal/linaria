import pack from './__utils__/compiler';
import rimraf from 'rimraf';
import Module from '../babel/module';
import path from 'path';

describe('webpack loader', () => {
  beforeEach(() => {
    rimraf.sync(path.join(__dirname, './__fixtures__/.linaria-cache'));
    Module.invalidateAll();
  });
  test('loader requires generated CSS file - css', async () => {
    const FILE = 'css-classname.js';
    const stats = await pack({ fixture: FILE });
    const modules: any[] = stats.toJson().modules;
    const output = modules.find(v => v.name.endsWith(FILE)).source;

    expect(output).toMatchSnapshot();
  });

  test('loader requires generated CSS file - styled', async () => {
    const FILE = 'styled-components.js';
    const stats = await pack({ fixture: FILE });
    const modules: any[] = stats.toJson().modules;
    const output = modules.find(v => v.name.endsWith(FILE)).source;

    expect(output).toMatchSnapshot();
  });

  test('complex loader works -- no-optimize', async () => {
    const FILE = 'styled-components.js';
    const stats = await pack({
      fixture: FILE,
      production: false,
      complex: true,
    });
    const modules: any[] = stats.toJson().modules;
    const output = modules.find(v => v.name.endsWith(FILE)).source;
    const css: string = stats.compilation.assets['styles.css'].source();
    expect(css.includes('LINARIA')).toBe(false);

    expect(output).toMatchSnapshot();
  });

  test('complex loader works -- optimizer', async () => {
    const FILE = 'styled-components.js';
    const stats = await pack({
      fixture: FILE,
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
  });
});
