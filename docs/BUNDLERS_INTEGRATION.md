# Bundlers Integration

We recognize that this process may be intimidating initially. Linaria takes the stance that it is better to push the complexity to the build process, rather than shipping the complexity for the client to parse (a la the original Styled Components). Read below to learn how to wire everything up.

## Pre-requisites

If you use Babel in your project, make sure to have a [config file for Babel](https://babeljs.io/docs/en/config-files) in your project root with the plugins and presets you use. Otherwise Linaria won't be able to parse the code.

## Bundlers

### webpack

To use Linaria with webpack, in your webpack config, add `linaria/loader` under `module.rules`:

```js
{
  test: /\.js$/,
  use: [
    { loader: 'babel-loader' },
    {
      loader: '@brandonkal/linaria/loader',
      options: {
        sourceMap: process.env.NODE_ENV !== 'production',
      },
    }
  ],
}
```

Make sure that `linaria/loader` is included after `babel-loader`.

Next, add the Linaria Plugin to your webpack config:

```js
const LinariaPlugin = require('@brandonkal/linaria/plugin');
// ...
config.plugins.push(new LinariaPlugin({ prefix: 'mui', optimize: true }));
```

The plugin is required to handle virtual files. We avoid writing intermediate extracted CSS files to disk during the build for performance reasons. The LinariaPlugin handles caching, module invalidation, and production class name optimization.

To have your styles extracted, you'll also need to use **css-loader** and **MiniCssExtractPlugin**. First, install them:

```sh
yarn add --dev css-loader mini-css-extract-plugin
```

Import `mini-css-extract-plugin` at the top of your webpack config:

```js
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
```

Linaria handles evaluation of JavaScript in your CSS. It is expected that you integrate Linaria with your existing CSS build pipeline, using a tool like postcss-loader to enable features such as nesting and auto-prefixing.

A minimal config would be to use postcss-nested and autoprefixer:

```sh
yarn add --dev postcss-loader postcss-nested autoprefixer
```

Then create a postcss.config.js file:

```js
module.exports = {
  plugins: {
    'postcss-nested': {},
    autoprefixer: {},
  },
};
```

Now add the following snippet in under `module.rules`:

```js
{
  test: /\.css$/,
  use: [
    {
      loader: MiniCssExtractPlugin.loader,
      options: {
        hmr: process.env.NODE_ENV === 'development',
        sourceMap: true,
      },
    },
    {
      loader: 'css-loader',
      options: { sourceMap: true },
    },
    '@brandonkal/linaria/fixSourceMap',
    {
      loader: 'postcss-loader',
      options: { sourceMap: true },
    },
    '@brandonkal/linaria/attachSourceMap',
  ],
},
```

Then add the following under `plugins`:

```js
new MiniCssExtractPlugin({
  filename: 'styles.css',
});
```

This will extract the CSS from all files into a single `styles.css`. Then you can link to this file in your HTML file manually or use something like [`HTMLWebpackPlugin`](https://github.com/jantimon/html-webpack-plugin).

Linaria integrates with your CSS pipeline, so you can always perform additional operations on the CSS, for example, using [postcss](https://postcss.org/) plugins such as [clean-css](https://github.com/jakubpawlowicz/clean-css) to further minify your CSS.

Before Linaria passes CSS to your CSS pipeline it will:

- Generate class names. The pre-processor cannot change it.
- Replace dynamic interpolations with CSS variables.
- Replace interpolations for JS objects with default syntax.

#### Full example

Here is an example webpack config with Linaria:

```js
const webpack = require('webpack');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const dev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: dev ? 'development' : 'production',
  devtool: 'source-map',
  entry: {
    app: './src/index',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/',
    filename: '[name].bundle.js',
  },
  optimization: {
    noEmitOnErrors: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: JSON.stringify(process.env.NODE_ENV) },
    }),
    new MiniCssExtractPlugin({ filename: 'styles.css' }),
    new LinariaPlugin({ prefix: 'a', optimize: true }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          { loader: 'cache-loader' },
          { loader: 'babel-loader' },
          {
            loader: '@brandonkal/linaria/loader',
            options: { sourceMap: dev },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              hmr: dev,
              sourceMap: dev,
            },
          },
          {
            loader: 'css-loader',
            options: { sourceMap: dev },
          },
          '@brandonkal/linaria/fixSourceMap',
          {
            loader: 'postcss-loader',
            options: { sourceMap: dev },
          },
          '@brandonkal/linaria/attachSourceMap',
        ],
      },
      {
        test: /\.(jpg|png|gif|woff|woff2|eot|ttf|svg)$/,
        use: [{ loader: 'file-loader' }],
      },
    ],
  },
  devServer: {
    contentBase: [path.join(__dirname, 'public')],
    historyApiFallback: true,
  },
};
```

Linaria will output CSS files with the same syntax and line numbers as the input. This allows for high resolution source maps. It will also fix relative `url()`s so that css-loader can locate these resources from the generated css file. To have the source maps point back to the original JavaScript files rather than the generated CSS file, you should wrap your css processor in the tiny source map helping loaders as shown above.

You can copy this file to your project if you are starting from scratch.

To install the dependencies used in the example config, run:

```sh
yarn add --dev webpack webpack-cli webpack-dev-server mini-css-extract-plugin css-loader css-hot-loader file-loader babel-loader
```

You can now run the dev server by running `webpack-dev-server` and build the files by running `webpack`.

#### Options

Refer to [configuration](/docs/CONFIGURATION.md) for options supported by the loader.

You can pass options to the loader like so:

```js
{
  loader: '@brandonkal/linaria/loader',
  options: {
    sourceMap: false,
    cacheDirectory: '.linaria-cache',
  },
}
```

### Rollup

To use Linaria with Rollup, you need to use it together with a plugin which handles CSS files, such as `rollup-plugin-css-only`:

```sh
yarn add --dev rollup-plugin-css-only
```

Then add them to your `rollup.config.js`:

```js
import linaria from '@brandonkal/linaria/rollup';
import css from 'rollup-plugin-css-only';

export default {
  /* rest of your config */
  plugins: [
    /* rest of your plugins */
    linaria({
      sourceMap: process.env.NODE_ENV !== 'production',
    }),
    css({
      output: 'styles.css',
    }),
  ],
};
```
