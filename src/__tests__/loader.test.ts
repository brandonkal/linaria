import compiler from './__utils__/compiler';

test('loader requires generated CSS file - css', async () => {
  const FILE = 'css-classname.js';
  const stats = await compiler({ fixture: FILE });
  const modules: any[] = stats.toJson().modules;
  const output = modules.find(v => v.name.endsWith(FILE)).source;

  expect(output).toMatchSnapshot();
});

test('loader requires generated CSS file - styled', async () => {
  const FILE = 'styled-components.js';
  const stats = await compiler({ fixture: FILE });
  const modules: any[] = stats.toJson().modules;
  const output = modules.find(v => v.name.endsWith(FILE)).source;

  expect(output).toMatchSnapshot();
});

test('complex loader works', async () => {
  const FILE = 'styled-components.js';
  const stats = await compiler({
    fixture: FILE,
    production: false,
    complex: true,
  });
  const modules: any[] = stats.toJson().modules;
  const output = modules.find(v => v.name.endsWith(FILE)).source;

  expect(output).toMatchSnapshot();
});

test('complex loader works -- optimizer', async () => {
  const FILE = 'styled-components.js';
  const stats = await compiler({
    fixture: FILE,
    production: true,
    complex: true,
    optimize: true,
  });
  const modules: any[] = stats.toJson().modules;
  const js = modules.find(v => v.name.endsWith(FILE)).source;
  const bundle: string = stats.compilation.assets['bundle.js'].source();
  const css: string = stats.compilation.assets['styles.css'].source();
  expect(css.includes('LINARIA')).toBeFalsy();
  expect(bundle.includes('LINARIA')).toBeFalsy();
  const snap =
    '// JS after Babel plugin before optimization\n' +
    js +
    '\n\n/* CSS after optimization */\n' +
    css;

  expect(snap).toMatchSnapshot();
});
