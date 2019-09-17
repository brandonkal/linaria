/* eslint-disable no-template-curly-in-string */

import dedent from 'dedent';
import transform from '../utils/transform';

it('rewrites a relative path in url() declarations', async () => {
  const { cssText } = await transform(
    dedent`
    import { css } from '@brandonkal/linaria';

    export const title = css\`
      background-image: url(./assets/test.jpg);
    \`;
    `,
    {
      filename: './test.js',
      outputFilename: '../.linaria-cache/test.css',
    }
  );

  expect(cssText).toMatchSnapshot();
});

it('injects global rules to the global scope', async () => {
  const { cssText } = await transform(
    dedent`
    import { injectGlobal } from '@brandonkal/linaria';

    injectGlobal\`
      /* an invalid rule */
      font-size: 10px;

      html {
        margin: 0;
      }

      body {
        color: black;
      }

    \`;
    `,
    {
      filename: './test.js',
      outputFilename: '../.linaria-cache/test.css',
    }
  );

  expect(cssText).toMatchSnapshot();
});

it('rewrites multiple relative paths in url() declarations', async () => {
  const { cssText } = await transform(
    dedent`
    import { css } from '@brandonkal/linaria';

    export const title = css\`
      @font-face {
        font-family: Test;
        src: url(./assets/font.woff2) format("woff2"), url(./assets/font.woff) format("woff");
      }
    \`;
    `,
    {
      filename: './test.js',
      outputFilename: '../.linaria-cache/test.css',
    }
  );

  expect(cssText).toMatchSnapshot();
});

it("doesn't rewrite an absolute path in url() declarations", async () => {
  const { cssText } = await transform(
    dedent`
    import { css } from '@brandonkal/linaria';

    export const title = css\`
      background-image: url(/assets/test.jpg);
    \`;
    `,
    {
      filename: './test.js',
      outputFilename: '../.linaria-cache/test.css',
    }
  );

  expect(cssText).toMatchSnapshot();
});

it('respects passed babel options', async () => {
  expect.assertions(2);
  try {
    await transform(
      dedent`
      import { css } from '@brandonkal/linaria';

      export const error = <jsx />;
      `,
      {
        filename: './test.js',
        outputFilename: '../.linaria-cache/test.css',
        pluginOptions: {
          babelOptions: {
            babelrc: false,
            configFile: false,
            presets: [['@babel/preset-env', { loose: true }]],
          },
        },
      }
    );
  } catch (e) {
    expect(e.message.includes('Unexpected token')).toBe(true);
  }

  await expect(
    transform(
      dedent`
      import { css } from '@brandonkal/linaria';

      export const error = <jsx />;
      export const title = css\`
        background-image: url(/assets/test.jpg);
      \`;
      `,
      {
        filename: './test.js',
        outputFilename: '../.linaria-cache/test.css',
        pluginOptions: {
          babelOptions: {
            babelrc: false,
            configFile: false,
            presets: [
              ['@babel/preset-env', { loose: true }],
              '@babel/preset-react',
            ],
          },
        },
      }
    )
  ).resolves.not.toThrow('Unexpected token');
});

it('handles transpiled template literals', async () => {
  expect.assertions(2);

  const result = await transform(
    dedent`
    import { css } from '@brandonkal/linaria';

    export const ok = <jsx />;
    export const title = css\`
      background-image: url(/assets/test.jpg);
    \`;
    `,
    {
      filename: './test.js',
      outputFilename: '../.linaria-cache/test.css',
      pluginOptions: {
        babelOptions: {
          babelrc: false,
          configFile: false,
          presets: [
            [
              '@babel/preset-env',
              {
                loose: true,
                targets: {
                  ie: 11,
                },
              },
            ],
            '@babel/preset-react',
          ],
        },
      },
    }
  );

  expect(result.code).toMatchSnapshot();
  expect(result.cssText).toMatchSnapshot();
});

it("doesn't throw due to duplicate preset", async () => {
  expect.assertions(1);

  await expect(
    transform(
      dedent`
      import { styled } from '../react';

      const Title = styled.h1\` color: blue; \`;

      const Article = styled.article\`
        ${'${Title}'} {
          font-size: 16px;
        }
      \`;
      `,
      {
        filename: './test.js',
        outputFilename: '../.linaria-cache/test.css',
        pluginOptions: {
          babelOptions: {
            babelrc: false,
            configFile: false,
            presets: [require.resolve('../babel')],
            plugins: [
              require.resolve('@babel/plugin-transform-modules-commonjs'),
            ],
          },
        },
      }
    )
  ).resolves.not.toThrow('Duplicate plugin/preset detected');
});
