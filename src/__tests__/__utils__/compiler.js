import path from 'path';
import webpack from 'webpack';
import memoryfs from 'memory-fs';
const LinariaOptimize = require('../../../lib/plugin.js');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const loaderPath = require.resolve('../../../lib/loader');

const simpleRules = [
  {
    test: /\.js$/,
    use: [
      {
        loader: loaderPath,
        options: {
          sourceMap: false,
        },
      },
    ],
  },
  {
    test: /\.css$/,
    use: [{ loader: path.resolve(__dirname, './ignore-loader.js') }],
  },
];

export default ({
  fixture,
  production = false,
  complex = false,
  optimize = false,
}) => {
  const mode = production ? 'production' : 'development';
  const complexRules = [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      use: [
        { loader: 'babel-loader' },
        {
          loader: loaderPath,
          options: { sourceMap: true, optimize: optimize },
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
            hmr: false,
            sourceMap: true,
          },
        },
        {
          loader: 'css-loader',
          options: { sourceMap: true },
        },
        {
          loader: require.resolve('../../../fixSourceMap.js'),
        },
        {
          loader: 'postcss-loader',
          options: { sourceMap: true },
        },
        {
          loader: require.resolve('../../../attachSourceMap.js'),
        },
      ],
    },
    {
      test: /\.(png|jpg|gif|svg)$/,
      use: [{ loader: 'file-loader' }],
    },
  ];

  const compiler = webpack({
    mode: mode,
    context: complex
      ? path.resolve(__dirname, '../../../')
      : path.resolve(__dirname, '../__fixtures__'),
    entry: complex ? `./src/__tests__/__fixtures__/${fixture}` : `./${fixture}`,
    output: {
      path: path.resolve(__dirname),
      filename: 'bundle.js',
    },
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },
    optimization: {
      noEmitOnErrors: false,
    },
    resolve: {
      alias: {
        '@brandonkal/linaria': path.resolve(__dirname, '../../../lib'),
      },
    },
    plugins: complex
      ? [
          new webpack.DefinePlugin({
            'process.env': { NODE_ENV: mode },
          }),
          new MiniCssExtractPlugin({ filename: 'styles.css' }),
          new LinariaOptimize(),
        ]
      : [],
    module: {
      rules: complex ? complexRules : simpleRules,
    },
  });

  compiler.outputFileSystem = new memoryfs();

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) reject(err);
      if (stats.hasErrors()) reject(new Error(stats.toJson().errors));

      resolve(stats);
    });
  });
};
