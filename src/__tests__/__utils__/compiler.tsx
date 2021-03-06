import path from 'path';
import webpack, { Configuration } from 'webpack';
import memoryfs from 'memory-fs';
import Linaria from '../../plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

const loaderPath = require.resolve('../../loader');

const simpleRules = [
  {
    test: /\.(js|jsx|ts|tsx)$/,
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

const babelConfig = {
  configFile: false,
  presets: [
    ['@babel/preset-env', { useBuiltIns: false, loose: true }],
    '@babel/preset-react',
    '@babel/preset-typescript',
  ],
  plugins: [['@babel/plugin-transform-runtime', { useESModules: true }]],
};

const pack = ({
  fixture,
  folder = '',
  production = false,
  complex = false,
  optimize = false,
}) => {
  const mode = production ? 'production' : 'development';
  const complexRules = [
    {
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /node_modules/,
      use: [
        { loader: 'babel-loader', options: babelConfig },
        {
          loader: loaderPath,
          options: {
            sourceMap: true,
            optimize: optimize,
            cacheDirectory: './.linaria-cache',
            babelOptions: babelConfig,
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
          loader: require.resolve('../../fixSourceMap.ts'),
        },
        {
          loader: require.resolve('postcss-loader'),
          options: { sourceMap: true },
        },
        {
          loader: require.resolve('../../attachSourceMap.ts'),
        },
      ],
    },
    {
      test: /\.(png|jpg|gif|svg)$/,
      use: [{ loader: 'file-loader' }],
    },
  ];

  const plugins = [
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: mode },
    }),
    new MiniCssExtractPlugin({ filename: 'styles.css' }),
    new Linaria({ optimize: !!complex }),
  ];

  const config: Configuration = {
    mode: mode,
    context: path.resolve(path.join(__dirname, '../__fixtures__', folder)),
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
      extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      alias: {
        '@brandonkal/linaria': path.resolve(__dirname, '../../../lib'),
        components: path.resolve(
          __dirname,
          '../__fixtures__/project/components'
        ),
      },
    },
    plugins: plugins,
    module: {
      rules: complex ? complexRules : simpleRules,
    },
  };

  const compiler = webpack(config);

  compiler.outputFileSystem = new memoryfs();

  return new Promise<webpack.Stats>((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      if (!stats) {
        reject(new Error('No webpack stats available'));
        return;
      }
      if (stats.hasErrors()) {
        reject(new Error(stats.toJson().errors.join(' ')));
        return;
      }
      resolve(stats);
    });
  });
};

export default pack;
