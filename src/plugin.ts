/* eslint-disable promise/prefer-await-to-then */
import path from 'path';
/* eslint-disable-next-line */
import { Compiler, compilation } from 'webpack';
import { ReplaceSource } from 'webpack-sources';
import { defaultOptions } from './utils/options';
import { StrictOptions } from './babel/types';
import VirtualModulesPlugin, {
  VirtualModulesOptions,
} from './utils/VirtualModules';
import { cssUpdateManager } from './loader';
import { evaluateModule } from './babel/module';
import * as compileCache from './babel/compileCache';

import debug from 'debug';
import TinyID from './utils/tinyId';
const log = debug('linaria:plugin');

const NAME = 'LinariaPlugin';

const LINARIA_REGEX = /LINARIA_.*?_LINARIA/g;

export interface LinariaPluginOptions extends VirtualModulesOptions {
  prefix?: string;
  optimize?: boolean;
  cacheDirectory?: string;
}

function uniq(arr: any[]) {
  return Array.from(new Set(arr));
}

/**
 * Linaria className optimization plugin.
 * This plugin also sets up the virtual modules.
 * Takes compiled assets and replaces classNames with optimized tiny identifiers.
 */
export default class LinariaPlugin {
  classes: string[] = [];
  opts: StrictOptions & Required<LinariaPluginOptions>;
  filesToUpdate = new Map<any, Set<string>>();
  tinyID: TinyID;
  Virtual: VirtualModulesPlugin;

  constructor(options: Partial<LinariaPluginOptions> = {}) {
    const opts = {
      ...defaultOptions,
      writeToDisk: true,
      filesystem: 'native',
      ...options,
      cacheDirectory: options.cacheDirectory || '.linaria-cache',
    } as const;
    this.opts = opts;
    this.tinyID = new TinyID({ prefix: opts.prefix, optimize: opts.optimize! });
    this.Virtual = new VirtualModulesPlugin([], {
      writeToDisk: this.opts.writeToDisk,
      filesystem: this.opts.filesystem,
    });
  }

  apply(compiler: Compiler) {
    /** A map of modules to a list of matched classNames in the source. */
    this.classes = [];
    if (!path.isAbsolute(this.opts.cacheDirectory)) {
      this.opts.cacheDirectory = path.join(
        compiler.context,
        this.opts.cacheDirectory
      );
    }

    this.Virtual.volumeFile = path.join(
      this.opts.cacheDirectory,
      'volume.json'
    );

    this.Virtual.apply(compiler);

    const updateVirtualCSS = async () => {
      cssUpdateManager.queue.forEach(evaluateModule);
      const updated: Promise<string>[] = [];
      cssUpdateManager.queue.forEach(filename => {
        if (!cssUpdateManager.ignored.has(filename)) {
          const updater = cssUpdateManager.updaters.get(filename);
          if (updater) {
            updated.push(updater.update());
          }
        }
      });
      try {
        await Promise.all(updated);
        return new Promise(resolve => {
          cssUpdateManager.queue.clear();
          cssUpdateManager.ignored.clear();
          resolve();
        });
      } catch (e) {
        log('Could not update all virtual CSS files');
        return Promise.reject('Could not update all virtual CSS files' + e);
      }
    };

    compiler.hooks.compilation.tap(NAME, compilation => {
      compilation.hooks.finishModules.tapPromise(NAME, updateVirtualCSS);
    });

    compiler.hooks.done.tapPromise(NAME, () => {
      compileCache.save();
      return Promise.resolve();
    });

    compiler.hooks.thisCompilation.tap(NAME, compilation => {
      compilation.hooks.normalModuleLoader.tap(NAME, loaderContext => {
        // Save a reference to the virtual module writer for the loader.
        loaderContext[NAME] = this.Virtual;
      });

      if (this.opts.optimize) {
        const optimizeClassNames = (chunks: compilation.Chunk[]) => {
          // Register all chunks
          chunks.forEach(chunk => {
            chunk.files.forEach(file => {
              let src = compilation.assets[file];
              if (src) {
                src = src.source();
              }
              if (!src || !src.includes('_LINARIA')) {
                return;
              }
              this._addMatches(file, src);
            });
          });
          // Run through all and replace
          let classes = uniq(this.classes).sort();
          const f = path.join(this.opts.cacheDirectory, 'id-maps.json');
          try {
            const j = compiler.inputFileSystem.readFileSync(f).toString();
            const record = JSON.parse(j);
            this.tinyID.record = record;
          } catch (e) {
            log(`Unable to read id map file ${f}, ${e}`);
            this.tinyID.record = {};
          }
          classes.forEach(cls => {
            this.tinyID.get(cls);
          });
          this.filesToUpdate.forEach((matches, file) => {
            const asset = compilation.assets[file];
            const newSource = new ReplaceSource(asset);
            const assetRawSource: string = asset.source().toString();
            matches.forEach(match => {
              if (match) {
                // Construct a new search
                const search = new RegExp(match, 'g');
                assetRawSource.replace(search, (...args) => {
                  const m = args[0];
                  const offset: number = args[args.length - 2];
                  newSource.replace(
                    offset,
                    offset + match.length - 1,
                    this.tinyID.get(match)
                  );
                  return m;
                });
              }
            });
            compilation.assets[file] = newSource;
          });
          this.classes = [];
          this.filesToUpdate.clear();
        };
        compilation.hooks.afterOptimizeChunkAssets.tap(
          NAME,
          optimizeClassNames
        );
      }
    });
    compiler.hooks.done.tap(NAME, () => {
      if (this.opts.optimize) {
        this.classes = [];
        this.filesToUpdate.clear();
      }
    });
  }

  private _addMatches(file: any, src: string) {
    if (src) {
      let matches = src.match(LINARIA_REGEX);
      if (matches) {
        this.classes.push(...matches);
        this.filesToUpdate.set(file, new Set([...matches]));
      }
    }
  }
}
