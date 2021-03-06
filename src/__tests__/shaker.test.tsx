/* eslint-disable no-template-curly-in-string */

import dedent from 'dedent';
import * as babel from '@babel/core';
import { ExternalDep } from '../babel/evaluate/DepsGraph';
import shake from '../babel/evaluate/shaker';

function _build(literal: TemplateStringsArray, ...placeholders: string[]) {
  const code = dedent(literal, ...placeholders);
  return {
    ast: babel.parseSync(code),
    code,
  };
}

function _shake(names: string[]) {
  return (
    literal: TemplateStringsArray,
    ...placeholders: string[]
  ): [string, ExternalDep[]] => {
    const { ast, code } = _build(literal, ...placeholders);
    if (!ast || !babel.types.isFile(ast)) return ['', []];
    const [shaken, deps] = shake(ast.program, names);
    const { code: transformed } = babel.transformFromAstSync(shaken, code)!;
    return [transformed!, deps];
  };
}

it('removes all', () => {
  const [shaken] = _shake([])`
    const { whiteColor: color, anotherColor } = require('…');
    const a = color || anotherColor;
    let fontSize = undefined;
    color.green = '#0f0';
  `;

  expect(shaken).toBe('export const __linariaPreval = [];');
});

it('keeps arrays', () => {
  const [shaken] = _shake([])`
    const arr = [first, second];
    export const one = arr[0];
    let two = null;
    function five() {
      return 5
    }
    export const another = [arr, two, 2 + 4 + five()];
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps function declaration', () => {
  const [shaken] = _shake([])`
    let two = null;
    function five() {
      return 5
    }
    export const nine = 4 + five();
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps only code which is related to `color`', () => {
  const [shaken] = _shake(['color'])`
    const { whiteColor: color, anotherColor } = require('…');
    const wrap = '';
    const a = color || anotherColor;
    color.green = '#0f0';
    module.exports = { color, anotherColor };
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps only code which is related to `anotherColor`', () => {
  const [shaken] = _shake(['anotherColor'])`
    const { whiteColor: color, anotherColor } = require('…');
    const a = color || anotherColor;
    color.green = '#0f0';
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps only code which is related to `a`', () => {
  const [shaken] = _shake(['a'])`
    const { whiteColor: color, anotherColor } = require('…');
    const a = color || anotherColor;
    color.green = '#0f0';
  `;

  expect(shaken).toMatchSnapshot();
});

it('shakes imports', () => {
  const [shaken] = _shake(['color', 'defaultColor'])`
    import { unrelatedImport } from '…';
    import { whiteColor as color, anotherColor } from '…';
    import defaultColor from '…';
    import anotherDefaultColor from '…';
    import '…';
    require('…');
    export default color;
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps member expression key', () => {
  const [shaken] = _shake(['blue'])`
    const key = 'blue';
    const obj = { blue: '#00F' };
    const blue = obj[key];
  `;

  expect(shaken).toMatchSnapshot();
});

it('shakes exports', () => {
  const [shaken] = _shake(['a'])`
    import { whiteColor as color, anotherColor } from '…';
    export const a = color;
    export { anotherColor };
  `;

  expect(shaken).toMatchSnapshot();
});

it('shakes export functions', () => {
  const [shaken] = _shake(['a'])`
    import { whiteColor as color, anotherColor } from '…';
    export const a = color;
    export { anotherColor as green };
    export default async function now() {}
    export function shakeMe(favorite) {
      console.log('hello')
      if (favorite) {
        return 'the color is ' + a
      }
      return 'no favorite color'
    }
  `;

  expect(shaken).toMatchSnapshot();
});

it('shakes export assignments', () => {
  const [shaken] = _shake([])`
  const { styled } = require('../react');

  let fontSize;

  export const Title = styled.h1\`
    font-size: ${'${fontSize}'};
  \`;
  `;

  expect(shaken).toMatchSnapshot();
});

it('shakes export declaration', () => {
  const [shaken] = _shake([])`
    import { whiteColor as color, anotherColor } from '…';
    const a = 42
    export function shakeMe(favorite) {
      console.log('hello')
      if (favorite) {
        return 'the color is ' + a
      }
      return 'no favorite color'
    }
  `;

  expect(shaken).toMatchSnapshot();
});

it('should throw away any side effects', () => {
  const [shaken] = _shake(['foo'])`
    const objects = { key: { fontSize: 12 } };
    const foo = (k) => {
      const obj = objects[k];
      console.log('side effect');
      return obj;
    };
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps objects as is', () => {
  const [shaken] = _shake(['fill1', 'fill2'])`
    const fill1 = (top = 0, left = 0, right = 0, bottom = 0) => ({
      position: 'absolute',
      top,
      right,
      bottom,
      left,
    });

    const fill2 = (top = 0, left = 0, right = 0, bottom = 0) => {
      return {
        position: 'absolute',
        top,
        right,
        bottom,
        left,
      };
    };
  `;

  expect(shaken).toMatchSnapshot();
});

it('shakes sequence expression', () => {
  const [shaken] = _shake(['color2'])`
    import { external } from '…';
    const color1 = (external, () => 'blue');
    let local = '';
    const color2 = (local = color1(), () => local);
  `;

  expect(shaken).toMatchSnapshot();
});

it('keeps undefined definitions', () => {
  const [shaken] = _shake(['fontSize'])`
  const { styled } = require('../react');

  let fontSize;u

  export const Title = styled.h1\`
    font-size: ${'${fontSize}'};
  \`;
  `;

  expect(shaken).toMatchSnapshot();
});
