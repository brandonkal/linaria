/* eslint-disable promise/prefer-await-to-then */
import VirtualStats from './VirtualStats';
import nativeFS from 'fs';
import path from 'path';
import debug from 'debug';
import util from 'util';
// eslint-disable-next-line
import webpack, { Compiler, InputFileSystem } from 'webpack'; // Type only import
const log = debug('linaria:virtual-modules');

declare module 'webpack' {
  interface InputFileSystem {
    /* add private types */
    _writeVirtualFile: (file: VirtualFile) => void;
    _virtualFilesLinaria: Map<string, VirtualFile>;
    _statStorage: any;
    _readFileStorage: any;
  }
}

const NAME = 'LinariaVirtualModulesPlugin';

interface stats {
  mtime: number;
}

interface IVirtualFile {
  path: string;
  contents: string | Buffer;
  stats?: stats;
}

class VirtualFile implements IVirtualFile {
  path: string;
  stats: VirtualStats;
  contents: string | Buffer;
  constructor(init: IVirtualFile) {
    if (!VirtualFile.isVirtualFile(init)) {
      throw new TypeError('Invalid virtual file initializer');
    }
    this.contents = init.contents;
    this.stats = new VirtualStats({
      size: init.contents ? Buffer.byteLength(init.contents) : 0,
      mtime: init.stats ? init.stats.mtime : Date.now(),
    });
    this.path = init.path;
  }
  static isVirtualFile(init: any) {
    return (
      (init != null &&
        (typeof init.contents === 'string' || Buffer.isBuffer(init.contents)) &&
        (typeof init.stats === 'object' ||
          typeof init.stats !== 'undefined')) ||
      typeof init.path === 'string'
    );
  }
}

export interface VirtualModulesOptions {
  writeToDisk: boolean;
  filesystem: 'native' | 'output';
}

class VirtualModulesPlugin {
  staticModules: VirtualFile[];
  private _compiler?: Compiler;
  private _watcher?: any;
  private _needsFlush = new Set<string>();
  opts: VirtualModulesOptions;
  volumeFile?: string;

  constructor(
    modules: IVirtualFile[],
    { writeToDisk = true, filesystem = 'native' }: VirtualModulesOptions
  ) {
    this.staticModules = modules.map(m =>
      m instanceof VirtualFile ? m : new VirtualFile(m)
    );
    this.opts = {
      writeToDisk,
      filesystem,
    };
    if (
      this.opts.filesystem !== 'native' &&
      this.opts.filesystem !== 'output'
    ) {
      throw new Error('VirtualModules filesystem expected `native` | `output`');
    }
  }
  /** access to the virtual files for the fs proxy */
  virtualFiles() {
    return this._compiler!.inputFileSystem._virtualFilesLinaria;
  }
  /** Remove virtual files after they have been written to disk. */
  clearVirtualFiles() {
    this._compiler!.inputFileSystem._virtualFilesLinaria = new Map();
  }
  /** Mark files which have been flushed to the output filesystem.
   * This is a simple approach to keep all virtual files in memory while
   * tracking which files need to be written on each update.
   */
  markFlushed(toRemove?: Set<string>) {
    if (toRemove && this._needsFlush && this._needsFlush.size) {
      toRemove.forEach(filename => this._needsFlush.delete(filename));
    }
  }
  /**
   * writeModule creates an in-memory module that Webpack will treat as if a real file exists at that location.
   */
  writeModule(fileObj: IVirtualFile) {
    this._checkActivation();
    const file =
      fileObj instanceof VirtualFile ? fileObj : new VirtualFile(fileObj);
    file.path = makeAbsolute(file.path, this._compiler!);
    log(this._compiler!.name || 'Main', 'Write module:', file.path);

    this._compiler!.inputFileSystem._writeVirtualFile(file);
    this._needsFlush.add(file.path);
    if (
      this._watcher &&
      this._watcher.watchFileSystem.watcher.fileWatchers.length
    ) {
      this._watcher.watchFileSystem.watcher.fileWatchers.forEach(
        (fileWatcher: any) => {
          if (fileWatcher.path === file.path) {
            log(this._compiler!.name || 'Main', 'Emit file change:', file.path);
            fileWatcher.emit('change', file.stats.mtime, null);
          }
        }
      );
    }
  }
  private _checkActivation() {
    if (!this._compiler) {
      throw new Error(
        'writeModule can only be called after creating a webpack instance!'
      );
    }
  }
  apply(compiler: Compiler) {
    this._compiler = compiler;

    const pathFilesystem = () => {
      if (!compiler.inputFileSystem._writeVirtualFile) {
        const originalPurge = compiler.inputFileSystem.purge;
        const fs = compiler.inputFileSystem;
        fs._virtualFilesLinaria = fs._virtualFilesLinaria || new Map();

        fs._writeVirtualFile = function(file) {
          this._virtualFilesLinaria = this._virtualFilesLinaria || new Map();
          this._virtualFilesLinaria.set(file.path, file);
          setData(this._statStorage, file.path, [null, file.stats]);
          setData(this._readFileStorage, file.path, [null, file.contents]);
        };

        fs.purge = function(this: InputFileSystem) {
          if (originalPurge) {
            originalPurge.apply(this, arguments as any);
          }
          if (this._virtualFilesLinaria) {
            this._virtualFilesLinaria.forEach(file => {
              setData(this._statStorage, file.path, [null, file.stats]);
              setData(this._readFileStorage, file.path, [null, file.contents]);
            });
          }
        };

        const filesystem = new Proxy(fs, handler);
        compiler.inputFileSystem = filesystem;
      }
      if (this.volumeFile) {
        const volumePath = makeAbsolute(this.volumeFile, compiler);
        try {
          const str = compiler.inputFileSystem
            .readFileSync(volumePath)
            .toString();
          const files = VirtualModulesPlugin.fromJSON(JSON.parse(str));
          files.forEach(this.writeModule);
        } catch (e) {
          log('Unable to load virtual volume file', volumePath);
        }
      }
    };

    const afterResolversHook = () => {
      if (this.staticModules) {
        this.staticModules.forEach(this.writeModule);
        this.staticModules = [];
      }
    };

    const watchRunHook = (watcher: any, callback: Function) => {
      this._watcher = watcher.compiler || watcher;
      callback();
    };

    if (this.opts.writeToDisk) {
      const writeFile: (
        path: string,
        data: any
      ) => Promise<void> = util.promisify(
        this.opts.filesystem === 'native'
          ? nativeFS.writeFile.bind(nativeFS)
          : compiler.outputFileSystem.writeFile.bind(compiler.outputFileSystem)
      );

      // const makeDir: (path: string) => Promise<void> = util.promisify(
      //   this.opts.filesystem === 'native'
      //     ? mkdirp.bind(mkdirp)
      //     : compiler.outputFileSystem.mkdirp.bind(compiler.outputFileSystem)
      // );

      const flushToRealFS = (compilation: any) => {
        if (!this.volumeFile) {
          log('No virtual volume file set. Skipping flush');
          return Promise.resolve();
        }
        const toFlush = new Set(this._needsFlush);
        if (!this._needsFlush.size) {
          return Promise.resolve();
        }
        log('Flushing virtual files to output FS');
        let mkdirpPromise = Promise.resolve();
        const files = this.virtualFiles();
        return mkdirpPromise
          .then(() => {
            const data = JSON.stringify([...files]);
            return writeFile(this.volumeFile!, data);
          })
          .then(() => {
            log(`Successfully wrote ${files.size} virtual files to output FS`);
            this.markFlushed(toFlush);
            return;
          })
          .catch(e => {
            const logger: typeof console = compilation.getLogger
              ? compilation.getLogger(NAME)
              : console;
            log('Failed to write virtual files to output FS', e);
            logger.warn(
              'Unable to flush all virtual files to the Output Filesystem. This may not break the build, but could cause subsequent builds to fail if aggressive caching expects this file on disk.\n',
              e
            );
            return;
          });
      };
      compiler.hooks.afterEmit.tapPromise(NAME, flushToRealFS);
    }

    compiler.hooks.afterEnvironment.tap(NAME, pathFilesystem);
    compiler.hooks.afterResolvers.tap(NAME, afterResolversHook);
    compiler.hooks.watchRun.tapAsync(NAME, watchRunHook);
  }
  /** convert a JSON object to a virtual file array. */
  static fromJSON(mapArr: [string, IVirtualFile][]): Map<string, VirtualFile> {
    const map = new Map();
    mapArr.forEach(v => {
      map.set(v[0], new VirtualFile(v[1]));
    });
    return map;
  }
}

const handler = {
  get(target: webpack.InputFileSystem, prop: keyof InputFileSystem) {
    if (prop === 'readFile') {
      const cache = target._virtualFilesLinaria;
      return (
        path: string,
        callback: (
          err: Error | null | undefined,
          buffer: Buffer | string
        ) => void
      ) => {
        if (cache && cache.has(path)) {
          callback(undefined, cache.get(path)!.contents);
        } else {
          target.readFile(path, callback);
        }
      };
    } else if (prop === 'readFileSync') {
      const cache = target._virtualFilesLinaria;
      return (path: string): string | Buffer => {
        if (cache && cache.has(path)) {
          return cache.get(path)!.contents;
        } else {
          return target.readFileSync(path);
        }
      };
    } else if (prop === 'stat') {
      const cache = target._virtualFilesLinaria;
      return (
        path: string,
        callback: (err: Error | undefined | null, stats: any) => void
      ) => {
        if (cache && cache.has(path)) {
          callback(undefined, cache.get(path)!.stats);
        } else {
          target.stat(path, callback);
        }
      };
    } else if (prop === 'statSync') {
      const cache = target._virtualFilesLinaria;
      return (path: string) => {
        if (cache && cache.has(path)) {
          return cache.get(path)!.stats;
        } else {
          return target.statSync(path);
        }
      };
    } else {
      return target[prop];
    }
  },
};

function makeAbsolute(filePath: string, compiler: Compiler) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(compiler.context, filePath);
}

function setData(storage: any, key: string, value: any) {
  if (storage.data instanceof Map) {
    storage.data.set(key, value);
  } else {
    storage.data[key] = value;
  }
}

export default VirtualModulesPlugin;
