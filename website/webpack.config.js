const webpack = require('webpack'); // eslint-disable-line import/no-extraneous-dependencies
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin'); // eslint-disable-line import/no-extraneous-dependencies

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
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          { loader: 'babel-loader' },
          {
            loader: require.resolve('../lib/loader'),
            options: { sourceMap: dev },
          },
        ],
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
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
          {
            loader: require.resolve('../fixSourceMap.js'),
          },
          {
            loader: 'postcss-loader',
            options: { sourceMap: true },
          },
          {
            loader: require.resolve('../attachSourceMap.js'),
          },
        ],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        use: [{ loader: 'file-loader' }],
      },
    ],
  },
};
