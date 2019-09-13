/* eslint-disable no-template-curly-in-string */

import * as babel from '@babel/core';
import dedent from 'dedent';
import { join, resolve } from 'path';
import stripAnsi from 'strip-ansi';
import Module from '../babel/module';

beforeEach(() => Module.invalidateAll());

import serializer from './__utils__/linaria-snapshot-serializer';

expect.addSnapshotSerializer(serializer);

const babelrc = {
  babelrc: false,
  presets: [
    [require.resolve('../babel'), { displayName: true, evaluate: true }],
  ],
};

const FULL = '@brandonkal/linaria/react';
const SHORT = '../react';

const transpile = async (input: string) => {
  const replaced = input.includes(FULL);
  const codeInput = input.replace(FULL, SHORT);
  const { code, metadata } = await babel.transformAsync(codeInput, {
    ...babelrc,
    filename: join(__dirname, 'source.js'),
  });

  return {
    metadata: metadata as typeof metadata & { keepEmptyLines?: boolean },
    code: replaced ? code.replace(SHORT, FULL) : code,
  };
};

it('evaluates identifier in scope', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const answer = 42;
    const foo = () => answer;
    const days = foo() + ' days';

    export const Title = styled.h1\`
      &:before {
        content: "${'${days}'}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates local expressions', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const answer = 42;
    const foo = () => answer;

    export const Title = styled.h1\`
      &:before {
        content: "${"${foo() + ' days'}"}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates functions with nested identifiers', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const objects = { key: { fontSize: 12 } };
    const foo = (k) => {
      const obj = objects[k];
      return obj;
    };

    export const Title = styled.h1\`
      ${"${foo('key')}"}
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates expressions with dependencies', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';
    import slugify from '../utils/slugify';

    export const Title = styled.h1\`
      &:before {
        content: "${"${slugify('test')}"}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates expressions with expressions depending on shared dependency', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';
    const slugify = require('../utils/slugify').default;

    const boo = t => slugify(t) + 'boo';
    const bar = t => slugify(t) + 'bar';

    export const Title = styled.h1\`
      &:before {
        content: "${"${boo('test') + bar('test')}"}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates multiple expressions with shared dependency', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';
    const slugify = require('../utils/slugify').default;

    const boo = t => slugify(t) + 'boo';
    const bar = t => slugify(t) + 'bar';

    export const Title = styled.h1\`
      &:before {
        content: "${"${boo('test')}"}"
        content: "${"${bar('test')}"}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evalutes interpolations with sequence expression', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';
    let external;

    export const Title = styled.h1\`
      color: ${'${(external, (() => "blue")())}'};
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evalutes dependencies with sequence expression', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';
    import external from './__fixtures__/sample-script.js'

    const color = (external, 'blue');

    export const Title = styled.h1\`
      color: ${'${color}'};
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates component interpolations', async () => {
  const { code, metadata } = await transpile(
    dedent`
    const { styled } = require('../react');

    export const Title = styled.h1\`
      color: red;
    \`;

    export const Paragraph = styled.p\`
      ${'${Title}'} {
        color: blue;
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('throws when interpolation evaluates to undefined', async () => {
  expect.assertions(1);

  try {
    await transpile(
      dedent`
      const { styled } = require('../react');

      let fontSize;

      export const Title = styled.h1\`
        font-size: ${'${fontSize}'};
      \`;
      `
    );
  } catch (e) {
    expect(
      stripAnsi(e.message.replace(__dirname, '<<DIRNAME>>'))
    ).toMatchSnapshot();
  }
});

it('throws when interpolation evaluates to null', async () => {
  expect.assertions(1);

  try {
    await transpile(
      dedent`
      const { styled } = require('../react');

      const color = null;

      export const Title = styled.h1\`
        color: ${'${color}'};
      \`;
      `
    );
  } catch (e) {
    expect(
      stripAnsi(e.message.replace(__dirname, '<<DIRNAME>>'))
    ).toMatchSnapshot();
  }
});

it('throws when interpolation evaluates to NaN', async () => {
  expect.assertions(1);

  try {
    await transpile(
      dedent`
      const { styled } = require('../react');

      const height = NaN;

      export const Title = styled.h1\`
        height: ${'${height}'}px;
      \`;
      `
    );
  } catch (e) {
    expect(
      stripAnsi(e.message.replace(__dirname, '<<DIRNAME>>'))
    ).toMatchSnapshot();
  }
});

it('handles wrapping another styled component', async () => {
  const { code, metadata } = await transpile(
    dedent`
    const { styled } = require('../react');

    const Title = styled.h1\`
      color: red;
    \`;

    export const CustomTitle = styled(Title)\`
      font-size: 24px;
      color: blue;
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('inlines object styles as CSS string', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const fill = (top = 0, left = 0, right = 0, bottom = 0) => ({
      position: 'absolute',
      top,
      right,
      bottom,
      left,
    });

    export const Title = styled.h1\`
      ${'${fill(0, 0)}'}
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('inlines array styles as CSS string', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const fill = (top = 0, left = 0, right = 0, bottom = 0) => [
      { position: 'absolute' },
      {
        top,
        right,
        bottom,
        left,
      }
    ];

    export const Title = styled.h1\`
      ${'${fill(0, 0)}'}
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('ignores inline arrow function expressions', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    export const Title = styled.h1\`
      &:before {
        content: "${'${props => props.content}'}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('ignores inline vanilla function expressions', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    export const Title = styled.h1\`
      &:before {
        content: "${'${function(props) { return props.content }}'}"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('ignores external expressions', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const generate = props => props.content;

    export const Title = styled.h1\`
      &:before {
        content: "${'${generate}'}px;"
      }
    \`;
    `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('evaluates complex styles with functions and nested selectors', async () => {
  const { code, metadata } = await transpile(
    dedent`
    import { css } from '../index.ts';
    export const bareIconClass = css\`\`;

    const getSizeStyles = (fs) => ({
      [\`${'&.${bareIconClass}'}\`]: {
        fontSize: fs * 1.5,
      },
    });

    export const SIZES = {
      XS: css\`${'${getSizeStyles(11)}'}\`,
    };
  `
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('throws codeframe error when evaluation fails', async () => {
  expect.assertions(1);

  try {
    await transpile(
      dedent`
      import { styled } from '@brandonkal/linaria/react';

      const foo = props => { throw new Error('This will fail') };

      export const Title = styled.h1\`
        font-size: ${'${foo()}'}px;
      \`;
      `
    );
  } catch (e) {
    expect(
      stripAnsi(e.message.replace(__dirname, '<<DIRNAME>>'))
    ).toMatchSnapshot();
  }
});

it('handles escapes properly', async () => {
  const { code, metadata } = await babel.transformFileAsync(
    resolve(__dirname, './__fixtures__/escape-character.js'),
    babelrc
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('handles complex component', async () => {
  const { code, metadata } = await babel.transformFileAsync(
    resolve(__dirname, './__fixtures__/complex-component.js'),
    babelrc
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('generates stable class names', async () => {
  const { code, metadata } = await babel.transformFileAsync(
    resolve(__dirname, './__fixtures__/components-library.js'),
    babelrc
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('derives display name from filename', async () => {
  const { code, metadata } = await babel.transformAsync(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    export default styled.h1\`
      font-size: 14px;
    \`;
    `,
    {
      ...babelrc,
      filename: join(__dirname, 'FancyName.js'),
    }
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('derives display name from parent folder name', async () => {
  const { code, metadata } = await babel.transformAsync(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    export default styled.h1\`
      font-size: 14px;
    \`;
    `,
    {
      ...babelrc,
      filename: join(__dirname, 'FancyName/index.js'),
    }
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('throws if unable to determine a display name', async () => {
  expect.assertions(1);

  try {
    await babel.transformAsync(
      dedent`
      import { styled } from '@brandonkal/linaria/react';

      export default styled.h1\`
        font-size: 14px;
      \`;
      `,
      {
        ...babelrc,
        filename: join(__dirname, '/.js'),
      }
    );
  } catch (e) {
    expect(
      stripAnsi(e.message.replace(__dirname, '<<DIRNAME>>'))
    ).toMatchSnapshot();
  }
});

it('does not make identifiers arrow functions', async () => {
  const { code, metadata } = await transpile(
    dedent`
      import { styled } from '../react';
      const Input = styled.input\`\`;

      export const Page = (p => styled.div\`
        color: #fff;
        ${'${Input}'} {
          color: #241047;
        }
      \`)({})
      `
  );
  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('does not transform identifiers to arrows that contain propsName', async () => {
  const { code, metadata } = await transpile(
    dedent`
      import { styled } from '../react';
      const Classes = { p: 'hello' }

      export const Page = (p => styled.div\`
        color: #fff;
        &.${'${Classes.p}'} {
          color: #241047;
        }
      \`)({})
      `
  );
  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

function lineOf(search: string, text: string) {
  const lines = text.split('\n');
  return lines.findIndex(line => line.includes(search)) + 1;
}

it('creates valid CSS with multiline interpolation', async () => {
  const source = dedent`
  import { styled } from '../react';

  function getNumber() {
    return 10
  }

  export const Page = (p => styled.div\`
    font-size: ${'${getNumber() +\n\
      2}'}px;
    background: black;
  \`)({})
  `;
  const { code, metadata } = await transpile(source);
  expect(code).toMatchSnapshot();
  expect(lineOf('background:', (metadata as any).linaria.cssText)).toBe(
    lineOf('background:', source)
  );
  metadata.keepEmptyLines = true;
  expect(metadata).toMatchSnapshot();
});

it('does not transform identifiers to arrows that contain propsName 2', async () => {
  const { code, metadata } = await transpile(
    dedent`
      import { styled } from '../react';
      const Classes = { p: 'hello' }
      const ap = Classes

      export const Page = (p => styled.div\`
        color: #fff;
        &.${'${Classes["p"]}'} {
          color: #241047;
        }
        &.${'${ap["p"]}'} {
          color: #241047;
        }
      \`)({})
      `
  );
  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});

it('does not strip instanbul coverage sequences', async () => {
  const { code, metadata } = await babel.transformAsync(
    dedent`
    import { styled } from '@brandonkal/linaria/react';

    const a = 42;

    export const Title = styled.h1\`
      height: ${'${a}'}px;
    \`;
    `,
    {
      ...babelrc,
      cwd: '/home/user/project',
      filename: 'file.js',
      plugins: [
        [
          // eslint-disable-next-line import/no-extraneous-dependencies
          require('babel-plugin-istanbul').default,
          { cwd: '/home/user/project' },
        ],
      ],
    }
  );

  expect(code).toMatchSnapshot();
  expect(metadata).toMatchSnapshot();
});
