import fs from 'fs';
import path from 'path';
import normalize from 'normalize-path';
import crypto from 'crypto';
import loaderUtils from 'loader-utils';
import validateOptions from 'schema-utils';
import enhancedResolve from 'enhanced-resolve';
import Module, { reloadModules, findAllDependents } from './babel/module';
import transform, { Result } from './utils/transform';
import fixError from './babel/utils/fixError';
// eslint-disable-next-line import/no-extraneous-dependencies
import { loader } from 'webpack'; // type only import
import { RawSourceMap } from 'source-map';
import util from 'util';
import { schema } from './utils/options';

const PnpWebpackPlugin = require('pnp-webpack-plugin');

import debug from 'debug';
import { Replacer, RuleBase } from './babel/types';
import buildCSS from './utils/buildCSS';
import VirtualModulesPlugin from './utils/VirtualModules';
const log = debug('linaria:loader');

function digest(str: string) {
  return crypto
    .createHash('md5')
    .update(str)
    .digest('hex');
}

const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];

/**
 * Keep track of CSS. This allows hot reloading of CSS seperately from JS.
 * A Map of JS source file to CSSUpdater instance.
 */
export const cssUpdateManager = {
  updaters: new Map<string, CSSUpdater>(),
  queue: new Set<string>(),
  ignored: new Set<string>(),
} as const;

// Keep track of requested files. We only clear dependents on rebuilds.
const requested = new Set<string>();

let linariaResolver: (id: string, parent: any) => string;

interface LoaderThis extends loader.LoaderContext {
  LinariaPlugin: VirtualModulesPlugin;
}

export default async function linariaLoader(
  this: LoaderThis,
  content: string,
  inputSourceMap?: RawSourceMap
) {
  log(`Executing loader for ${this.resourcePath}`);
  const callback = this.async()!;
  this.cacheable();
  const options = loaderUtils.getOptions(this) || {};
  validateOptions(schema, options, 'Linaria Loader');
  if (typeof this.LinariaPlugin === 'undefined') {
    callback(new Error('Linaria loader requires LinariaPlugin'), content);
    return;
  }

  let addGhostFile = () => {};

  if (!requested.has(this.resourcePath)) {
    requested.add(this.resourcePath);
    // We add a virtual ghost file. This allows us to transparently support cache-loader.
    // On the first compilation, the LinariaPlugin will update the mtime for this file.
    addGhostFile = () => {
      const ghostPath = path.join(
        this.rootContext,
        '.linaria-cache/ghost.linaria'
      );
      this.addDependency(ghostPath);
    };
  } else {
    // We clear on hot rebuilds.
    // If we could be sure that modules don't execute code in module scope
    // (only export functions) this step could be omitted.
    const deps = findAllDependents(this.resourcePath);
    log(`Clearing ${deps.size} dependent modules for ${this.resourcePath}.`);
    reloadModules(deps);
    cssUpdateManager.ignored.add(this.resourcePath);
    deps.forEach(dep => cssUpdateManager.queue.add(dep));
  }

  const {
    sourceMap: enableSourceMap = true,
    cacheDirectory: cacheName = '.linaria-cache',
    ...pluginOptions
  } = options;

  const filePrefix = this.mode === 'production' ? 'prod' : 'dev';

  const cacheDirectory = path.isAbsolute(cacheName)
    ? cacheName
    : path.join(this.rootContext, cacheName);

  const relative = path.relative(this.rootContext, this.resourcePath);

  const outputFilename =
    // note that while we could use a short path with virtual files,
    // other loaders expect to be able to find postCSS config files by walking up the tree.
    // This has the side effect that volume.json is not portable as paths
    path.join(cacheDirectory, 'css', digest(relative)) +
    `.${filePrefix}.linaria.css`;

  createResolver.call(this);

  let result: Result;

  try {
    // Use webpack's resolution when evaluating modules
    Module._resolveFilename = linariaResolver;
    Module._fs = this.fs;

    result = await transform(content, {
      filename: this.resourcePath,
      inputSourceMap: inputSourceMap != null ? inputSourceMap : undefined,
      cssOutputFilename: outputFilename,
      pluginOptions,
      cacheDirectory,
    });
  } catch (e) {
    callback(fixError(e));
    return;
  }

  if (result.cssText) {
    addGhostFile();
    let { cssText, cssSourceMap, replacer, rules } = result;
    const cssWriter = async (css: string) =>
      updateCSS(
        css,
        outputFilename,
        this.LinariaPlugin,
        cssSourceMap,
        enableSourceMap,
        this.fs
      );
    await cssWriter(cssText);
    callback(
      null,
      `${
        result.code
      }\n\n// Injected by Linaria Loader for Webpack Compilation (virtual)\nrequire(${loaderUtils.stringifyRequest(
        this,
        normalize(outputFilename)
      )});`,
      result.sourceMap
    );
    if (rules && rules.length && replacer) {
      const updater = new CSSUpdater(
        outputFilename,
        rules!,
        replacer!,
        cssWriter
      );
      cssUpdateManager.updaters.set(this.resourcePath, updater);
    }
  } else {
    log(`done ${this.resourcePath} (skip css)`);
    callback(null, result.code, result.sourceMap);
  }
}

class CSSUpdater {
  update: () => Promise<string>;
  rules: RuleBase[];
  filename: string;
  constructor(
    cssFilename: string,
    rules: RuleBase[],
    replacer: Replacer,
    cssWriter: (css: string) => Promise<string>
  ) {
    this.rules = rules;
    this.filename = cssFilename;
    this.update = () => {
      log(`Rebuilding CSS for ${this.filename}`);
      const css = buildCSS(this.rules, replacer);
      return cssWriter(css);
    };
  }
}

interface reqFS {
  readFile: typeof fs.readFile;
}

/**
 * updateCSS checks the current CSS file on the filesystem
 * and checks if CSS should be written. If a CSS write is required,
 * a source map is appended and a virtual Module is written.
 * @returns a promise for the written CSS text.
 */
async function updateCSS(
  cssText: string,
  outputFilename: string,
  Virtual: VirtualModulesPlugin,
  cssSourceMap?: RawSourceMap,
  enableSourceMap?: boolean,
  FS?: reqFS
): Promise<string> {
  const inFS = FS || fs;
  const readFile = util.promisify(inFS.readFile);
  // Read the file first to compare the content
  // Write the new content only if it's changed
  // In development, we compare the contents without the trailing empty lines at the end
  // of the file and sourceMap comment.
  // However, in production, we will always write a new CSS file if the contents differ.
  // This will prevent unnecessary WDS reloads
  let currentCss = '';
  try {
    currentCss = (await readFile(outputFilename)).toString();
  } catch (e) {
    // Ignore error
  }
  function appendSourceMap() {
    let cssOutput = cssText.trimRight();
    let update = false;
    let re = /\/\*# sourceMappingURL=data:application\/json;base64,.*$/m;
    const trimmed = (str: string) => {
      return str
        .replace(re, '')
        .trimRight()
        .replace(/\s*$/, '');
    };

    if (process.env.NODE_ENV !== 'production') {
      if (trimmed(currentCss) !== trimmed(cssText)) {
        update = true;
        if (enableSourceMap) {
          cssOutput +=
            `\n/*# sourceMappingURL` +
            `=data:application/json;base64,${Buffer.from(
              JSON.stringify(cssSourceMap || '')
            ).toString('base64')}*/`;
        }
      }
    } else {
      // Production
      if (enableSourceMap) {
        cssOutput +=
          `\n/*# sourceMappingURL` +
          `=data:application/json;base64,${Buffer.from(
            JSON.stringify(cssSourceMap || '')
          ).toString('base64')}*/`;
      }
      if (currentCss.trimRight() !== cssOutput) {
        update = true;
      }
    }
    return { cssOutput: cssText, update };
  }
  const { cssOutput, update } = appendSourceMap();
  if (update) {
    log(`updating css file: ${outputFilename}`);
    Virtual.writeModule({ path: outputFilename, contents: cssOutput });
  } else {
    log(`done ${outputFilename} (no css update)`);
  }
  return cssText;
}

let lastCompilation: any;
/**
 * Generates a resolver if required
 */
function createResolver(this: loader.LoaderContext) {
  if (
    typeof linariaResolver !== 'function' ||
    lastCompilation !== this._compilation
  ) {
    const resolveSync = enhancedResolve.create.sync(
      // this.resolveSync and this._compilation are deprecated APIs
      // There is this.resolve, but it's asynchronous
      // This API is used by many loaders/plugins, so we should be safe for a while
      this._compilation && this._compilation.options.resolve
        ? {
            fileSystem: this.fs || fs,
            alias: this._compilation.options.resolve.alias,
            modules: this._compilation.options.resolve.modules,
            extensions: this._compilation.options.resolve.extensions
              ? this._compilation.options.resolve.extensions.filter(
                  (ext: string) => supportedExtensions.includes(ext)
                )
              : supportedExtensions,
            plugins: [PnpWebpackPlugin],
          }
        : {
            extensions: supportedExtensions,
            fileSystem: this.fs || fs,
            plugins: [PnpWebpackPlugin],
          }
    );
    lastCompilation = this._compilation;
    linariaResolver = (id: string, { filename }) => {
      return resolveSync(path.dirname(filename), id);
    };
  }
}
