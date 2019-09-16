import path from 'path';
import dedent from 'dedent';
import * as babel from '@babel/core';
import Module from '../babel/module';
import stripAnsi from 'strip-ansi';

const test = path.resolve(__dirname, './__fixtures__/test.js');

beforeEach(() => Module.invalidateAll());

function transform(codeAndMap) {
  return babel.transformSync(codeAndMap.code, {
    filename: this.filename,
  });
}

it('creates module for JS files', () => {
  const filename = '/foo/bar/test.js';
  const mod = new Module(filename);

  mod.evaluate({ code: 'module.exports = () => 42', map: null });

  expect(mod.exports()).toBe(42);
  expect(mod.id).toBe(filename);
  expect(mod.filename).toBe(filename);
});

it('evaluates files with global exports in strict mode', () => {
  const mod = new Module(test);
  const gen = {
    code: dedent`
      'use strict'
      exports = module.exports = function funcToExport() {}
      exports['default'] = exports;
  `,
    map: null,
  };
  mod.evaluate(gen, true);
  expect(typeof mod.exports).toBe('function');
  expect(typeof mod.exports.default).toBe('function');
});

it('requires JS files', () => {
  const mod = new Module(test);
  const gen = {
    code: dedent`
  const answer = require('./sample-script');

  module.exports = 'The answer is ' + answer;
  `,
    map: null,
  };
  mod.evaluate(gen);

  expect(mod.exports).toBe('The answer is 42');
});

it('requires JSON files', () => {
  const mod = new Module(test);
  const gen = {
    code: dedent`
  const data = require('./sample-data.json');

  module.exports = 'Our saviour, ' + data.name;
  `,
    map: null,
  };
  mod.evaluate(gen);

  expect(mod.exports).toBe('Our saviour, Luke Skywalker');
});

it('imports JS files', () => {
  const mod = new Module(test);

  mod.transform = transform;
  const gen = {
    code: dedent`
    import answer from './sample-script';

    export const result = 'The answer is ' + answer;
  `,
    map: null,
  };
  mod.evaluate(gen);

  expect(mod.exports.result).toBe('The answer is 42');
});

it('imports TypeScript files', () => {
  const mod = new Module(path.resolve(__dirname, './__fixtures__/test.ts'));

  mod.transform = transform;
  mod.evaluate({
    code: dedent`
    import answer from './sample-typescript';

    export const result = 'The answer is ' + answer;
  `,
    map: null,
  });

  expect(mod.exports.result).toBe('The answer is 27');
});

it('imports JSON files', () => {
  const mod = new Module(test);

  mod.transform = transform;
  mod.evaluate({
    code: dedent`
    import data from './sample-data.json';

    const result = 'Our saviour, ' + data.name;

    export default result;
  `,
    map: null,
  });

  expect(mod.exports.default).toBe('Our saviour, Luke Skywalker');
});

it('returns module from the cache', () => {
  /* eslint-disable no-self-compare */

  const filename = test;
  const mod = new Module(filename);
  const id = './sample-data.json';

  expect(mod.require(id) === mod.require(id)).toBe(true);

  expect(
    new Module(filename).require(id) === new Module(filename).require(id)
  ).toBe(true);
});

it('clears modules from the cache', () => {
  const filename = test;
  const id = './sample-data.json';

  const result = new Module(filename).require(id);

  expect(result === new Module(filename).require(id)).toBe(true);

  Module.invalidateAll();

  expect(result === new Module(filename).require(id)).toBe(false);
});

it('exports the path for non JS/JSON files', () => {
  const mod = new Module(test);

  expect(mod.require('./sample-asset.png')).toBe('./sample-asset.png');
});

it('returns module when requiring mocked builtin node modules', () => {
  const mod = new Module(test);

  expect(mod.require('path')).toBe(require('path'));
});

it('returns null when requiring empty builtin node modules', () => {
  const mod = new Module(test);

  expect(mod.require('fs')).toBe(null);
});

it('throws when requiring unmocked builtin node modules', () => {
  const mod = new Module(test);

  expect(() => mod.require('perf_hooks')).toThrow(
    'Unable to import "perf_hooks". Importing Node builtins is not supported in the sandbox.'
  );
});

it('includes code frame in Errors', () => {
  const mod = new Module(test);
  try {
    mod.evaluate({
      code: dedent`
    const a = 1;
    const b = 2;
    throw new Error ('cleanup on isle 3');
    `,
      map: null,
    });
  } catch (e) {
    expect(e.message).toBe('cleanup on isle 3');
    expect(
      stripAnsi(e.stack.replace(__dirname, '<<DIRNAME>>'))
    ).toMatchSnapshot();
  }
});

it('has access to the global object', () => {
  const mod = new Module(test);

  expect(() =>
    mod.evaluate(
      {
        code: dedent`
    new global.URL('http://example.com');
  `,
        map: null,
      },
      true
    )
  ).not.toThrow();
});

it("doesn't have access to the process object", () => {
  const mod = new Module(test);

  expect(() =>
    mod.evaluate(
      {
        code: dedent`
    process.abort();
  `,
        map: null,
      },
      true
    )
  ).toThrow('process.abort is not a function');
});

it('has access to NODE_ENV', () => {
  const mod = new Module(test);

  mod.evaluate(
    {
      code: dedent`
  module.exports = process.env.NODE_ENV;
  `,
      map: null,
    },
    true
  );

  expect(mod.exports).toBe(process.env.NODE_ENV);
});

it('has require.resolve available', () => {
  const mod = new Module(test);

  mod.evaluate(
    {
      code: dedent`
  module.exports = require.resolve('./sample-script');
  `,
      map: null,
    },
    true
  );

  expect(mod.exports).toBe(
    path.resolve(path.dirname(mod.filename), 'sample-script.js')
  );
});

it('has require.ensure available', () => {
  const mod = new Module(test);

  expect(() =>
    mod.evaluate(
      {
        code: dedent`
  require.ensure(['./sample-script']);
  `,
        map: null,
      },
      true
    )
  ).not.toThrow();
});

it('has __filename available', () => {
  const mod = new Module(test);

  mod.evaluate(
    {
      code: dedent`
  module.exports = __filename;
  `,
      map: null,
    },
    true
  );

  expect(mod.exports).toBe(mod.filename);
});

it('has __dirname available', () => {
  const mod = new Module(test);

  mod.evaluate(
    {
      code: dedent`
  module.exports = __dirname;
  `,
      map: null,
    },
    true
  );

  expect(mod.exports).toBe(path.dirname(mod.filename));
});

it('changes resolve behaviour on overriding _resolveFilename', () => {
  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = id => (id === 'foo' ? 'bar' : id);

  const mod = new Module(test);

  mod.evaluate(
    {
      code: dedent`
  module.exports = [
    require.resolve('foo'),
    require.resolve('test'),
  ];
  `,
      map: null,
    },
    true
  );

  // Restore old behavior
  Module._resolveFilename = originalResolveFilename;

  expect(mod.exports).toEqual(['bar', 'test']);
});
