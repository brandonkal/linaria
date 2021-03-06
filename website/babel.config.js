module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-react'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@brandonkal/linaria': '../lib',
        },
      },
    ],
  ],
  env: {
    server: {
      presets: [
        ['@babel/preset-env', { targets: { node: 8 } }],
        require.resolve('../lib/babel'),
      ],
      plugins: [
        [
          'file-loader',
          {
            publicPath: '/dist',
            outputPath: '/dist',
          },
        ],
      ],
    },
  },
};
