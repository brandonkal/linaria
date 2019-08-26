import path from 'path';
import webpack from 'webpack';
import memoryfs from 'memory-fs';
const LinariaOptimize = require('../../plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const loaderPath = require.resolve('../../loader');

const simpleRules = [
  {
    test: /\.js$/,
    use: [
      {
        loader: loaderPath,
        options: {
          sourceMap: false,
          cacheDirectory: './.linaria-cache',
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
          options: {
            sourceMap: true,
            optimize: optimize,
            cacheDirectory: './.linaria-cache',
          },
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
          loader: require.resolve('css-loader'),
          options: { sourceMap: true },
        },
        {
          loader: require.resolve('../../../fixSourceMap.js'),
        },
        {
          loader: require.resolve('postcss-loader'),
          options: { sourceMap: true },
        },
        {
          loader: require.resolve('../../../attachSourceMap.js'),
        },
      ],
    },
  ];

  const plugins = [
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: mode },
    }),
    new MiniCssExtractPlugin({ filename: 'styles.css' }),
  ];
  if (complex) {
    plugins.push(new LinariaOptimize({ optimize: optimize }));
  }

  const task = webpack({
    mode: mode,
    context: path.resolve(__dirname, '../__fixtures__'),
    entry: `./${fixture}`,
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
    plugins: plugins,
    module: {
      rules: complex ? complexRules : simpleRules,
    },
  });

  task.outputFileSystem = new memoryfs();

  return new Promise((resolve, reject) => {
    task.run((err, stats) => {
      if (err) reject(err);
      if (stats.hasErrors()) reject(new Error(stats.toJson().errors));

      resolve(stats);
    });
  });
};
