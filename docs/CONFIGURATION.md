# Configuration

Linaria accepts some options to meet your requirements.

## Webpack Plugin Options

The plugin accepts the following options:

- `prefix: string` (default: `''`)

  Apply a prefix when optimizing classnames. i.e. "mui".

- `optimize: boolean` (default: `process.env.NODE_ENV === 'production'`)

  Generate incredibly short identifiers for CSS class names. i.e. `a`. This defaults to be true when NODE_ENV is "production". When false, you will see longer descriptive names.

- `cacheDirectory: string` (default: `'.linaria-cache'`)

  See below. Should match loader cache directory.

- `writeToDisk: boolean` (default: `true`)

  The LinariaPlugin provides a virtual module system for the intermediate extracted CSS files. This avoid the extra step of waiting for the filesystem to write the file to disk only to be read again by the first CSS loader. Linaria can persist this data to a JSON file. During the webpack build, LinariaPlugin reads this file from the cache directory and hydrates webpack's input filesystem with these virtual CSS files.

- `filesystem: 'native' | 'output'` (default: `'native'`)

  Specify the filesystem to write the virtual volume. Defaults to use the native filesytem, but you can override this.

## Loader Options

The loader accepts the following options:

- `sourceMap: boolean` (default: `true`):

  Setting this option to `true` will include a source map comment in the generated CSS so that you can see where the source of the class names are devtools.

  Note that the `@brandonkal/linaria/attachSourceMap` loader will extract this comment, so webpack can further process it. Because it is later extracted, the default option of true should have no effect on final bundle size.

- `cacheDirectory: string` (default: `'.linaria-cache'`):

  Path to the directory where the loader will output the intermediate CSS files. You can pass a relative or absolute directory path. Make sure the directory is inside the working directory for things to work properly. **You should add this directory to `.gitignore` so you don't accidentally commit them.**

  Typically this should not be changed from the default. Relative paths will be relative to the webpack root directory. Note that postCSS loader will expect to be able to resolve a config file from here.

## Shared Options

These options are accepted by the babel preset and loader. The plugin will also accept extra options, so you can share an options object for both.

- `evaluate: boolean` (default: `true`):

  Enabling this will evaluate dynamic expressions in the CSS. You need to enable this if you want to use imported variables in the CSS or interpolate other components. Enabling this also ensures that your styled components wrapping other styled components will have the correct specificity and override styles properly.

- `displayName: boolean` (default: `process.env.NODE_ENV !== 'production'`):

  Enabling this will add a display name to generated class names, e.g. `.Title_abcdef` instead of `.abcdef'. It is enabled only in non-production environments to generate smaller CSS files.

- `prefix: string` (default: `''`):

  Add a prefix to generated class and variable names. You may find this useful for publishing style libraries.

- `optimize: boolean` (default: `process.env.NODE_ENV === 'production'`):

  Enabling this will optimize class and variable names to extremely short identifiers. e.g. `.a` instead of `Title_abcdef`. It is enabled by default for production builds to generate smaller CSS files.

- `ignore: RegExp` (default: `/node_modules/`):

  If you specify a regular expression here, files matching the expression won't be processed, i.e. the matching files won't be transformed with Babel during evaluation. If you need to compile certain modules under `/node_modules/`, it's recommended to do it on a module by module basis for faster transforms, e.g. `ignore: /node_modules[\/\\](?!some-module|other-module)/`.

- `babelOptions: Object`

  If you need to specify custom babel configuration, you can pass them here. These babel options will be used by Linaria when parsing and evaluating modules.

## `@brandonkal/linaria/babel` preset

The preset pre-processes and evaluates the CSS inside your files. The bundler plugins use this preset under the hood. You also may want to use this preset if you import the components outside of the files handled by your bundler, such as on your server or in unit tests.

To use this preset, add `@brandonkal/linaria/babel` to your Babel configuration at the end of the presets list:

`.babelrc`:

```diff
{
  "presets": [
    "@babel/preset-env",
    "@babel/preset-react",
+   "@brandonkal/linaria/babel"
  ]
}
```

Seperate config file support has been deprecated in favor of explicit configuration. You can easily share configuration and import it where it is needed using `import` or `require()`.
