/* eslint-disable no-ex-assign */
/**
 * This is a custom implementation for the module system for evaluating code.
 *
 * This serves 2 purposes:
 * - Avoid leakage from evaled code to module cache in current context, e.g. `babel-register`
 * - Allow us to invalidate the module cache without affecting other stuff, necessary for rebuilds
 *
 * We also use it to transpile the code with Babel by default.
 *
 */

import NativeModule from 'module';
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { createSandbox } from './sandbox';
import { BabelFileResult } from '@babel/core';
import { GeneratorResult } from '@babel/generator';
import debug from 'debug';
import { codeFrameColumns } from '@babel/code-frame';
import fixError from './utils/fixError';
import * as compileCache from './compileCache';
import * as errorQueue from './utils/errorQueue';
const log = debug('linaria:module');
import './sourceMapRegister';
import mtime from './utils/mtime';
import { writeAndFlushConsole } from './console';

let sandbox = createSandbox();

// Supported node builtins based on the modules polyfilled by webpack
// `true` means module is polyfilled, `false` means module is empty
const builtins = {
  assert: true,
  buffer: true,
  child_process: false,
  cluster: false,
  console: true,
  constants: true,
  crypto: true,
  dgram: false,
  dns: false,
  domain: true,
  events: true,
  fs: false,
  http: true,
  https: true,
  module: false,
  net: false,
  os: true,
  path: true,
  punycode: true,
  process: true,
  querystring: true,
  readline: false,
  repl: false,
  stream: true,
  string_decoder: true,
  sys: true,
  timers: true,
  tls: false,
  tty: true,
  url: true,
  util: true,
  vm: true,
  zlib: true,
};

// Separate cache for evaluated modules. Also available on require.cache
let cache: { [filename: string]: Module } = {};

const NOOP = () => {};

/**
 * matches: [1] filename [2] line number [3] column number
 */
const StackFrameRe = /([^ ():]+):(\d+)(?::(\d+))?/;

interface NM extends NativeModule {
  _nodeModulePaths: (filename: string) => string[];
  _resolveFilename: (id: string, options: any) => string;
  _extensions: { [key: string]: Function };
}

/**
 * makeModule gets the module if it already is cached or
 * creates a new Module and adds it to the cache.
 */
export function makeModule(filename: string) {
  let m = cache[filename];
  if (!m) {
    m = new Module(filename);
    cache[filename] = m;
  }
  return m;
}

/**
 * reloadModules takes a list of modules and resets their evaluations.
 */
export function reloadModules(filenames: Set<string> | string[]) {
  filenames.forEach((mod: string) => {
    log(`Resetting module: ${mod}`);
    const m = cache[mod];
    if (m) {
      m.load();
    }
  });
}

/**
 * Evaluates a module only if required.
 */
export function evaluateModule(mod: string) {
  const m = cache[mod];
  /* private only for file */
  if (m && !m.loaded && (m as any)._transformed) {
    log(`Reloading updated module: ${mod}`);
    m.evaluate();
  } else {
    log(`Reload skipped for module: ${mod}`);
  }
}

export function findAllDependents(filename: string) {
  const alive = new Set<string>();
  let deps: string[] = [filename];
  while (deps.length > 0) {
    // Mark all dependencies as alive
    deps.forEach(d => alive.add(d));
    // Collect new dependencies of dependencies
    deps = getDependents(deps).filter(d => !alive.has(d));
  }

  return alive;

  function getDependents(filenames: string[]) {
    let res: string[] = [];
    filenames.forEach(file => {
      let m = cache[file];
      if (m && m.dependents) {
        res.push(...m.dependents);
      }
    });
    return res;
  }
}

class Module {
  static _resolveFilenameDefault = (
    id: string,
    parent: { id?: string; filename: string; paths?: string[] }
  ) => {
    return ((NativeModule as any) as NM)._resolveFilename(id, parent);
  };
  /**
   * Alias to resolve the module using node's resolve algorithm
   * This static property can be overriden by the webpack loader
   * This allows us to use webpack's module resolution algorithm
   */
  static _resolveFilename = Module._resolveFilenameDefault;

  static _nodeModulePaths = (filename: string) =>
    ((NativeModule as any) as NM)._nodeModulePaths(filename);

  static invalidateAll = () => {
    cache = {};
    sandbox = createSandbox();
    compileCache.clear();
  };

  /** Allows consumers to customize filesystem */
  static _fs = fs;

  readonly id: string;
  readonly filename: string;
  readonly paths: string[];
  exports: any;
  extensions: string[];
  dependencies: Set<string>;
  /** Keep track of dependents for cache invalidation. Set to false if non JS/JSON asset. */
  dependents: Set<string> | false;
  transform: ((codeAndMap: GeneratorResult) => BabelFileResult) | null;
  /** A hash of the babel transform options */
  _cacheKey?: string;
  /** Represents the source as passed to evaluate. This may have already been transformed by the initial Linaria extraction. */
  private _source?: string;
  /** keep track of last modified date for file */
  mtime: number = 0;
  /* we store the code executed for when a source-map is unavailable. */
  private _transformed?: string;
  loaded?: boolean;

  constructor(filename: string) {
    this.id = filename;
    this.filename = filename;
    this.paths = [];
    this.dependencies = new Set();
    this.dependents = new Set();
    this.transform = null;

    Object.defineProperties(this, {
      id: {
        value: filename,
        writable: false,
      },
      filename: {
        value: filename,
        writable: false,
      },
      paths: {
        value: Object.freeze(
          ((NativeModule as any) as NM)._nodeModulePaths(path.dirname(filename))
        ),
        writable: false,
      },
    });

    this.exports = {};

    // We support following extensions by default
    this.extensions = ['.tsx', '.ts', '.js', '.jsx', '.json'];
  }

  resolve = (id: string) => {
    const extensions = ((NativeModule as any) as NM)._extensions;
    const added: string[] = [];

    try {
      // Check for supported extensions
      this.extensions.forEach(ext => {
        if (ext in extensions) {
          return;
        }
        // When an extension is not supported, add it
        // And keep track of it to clean it up after resolving
        // Use noop for the tranform function since we handle it
        extensions[ext] = NOOP;
        added.push(ext);
      });

      return Module._resolveFilename(id, this);
    } catch (e) {
      e.code = 'RESOLVE';
      throw e;
    } finally {
      // Cleanup the extensions we added to restore previous behaviour
      added.forEach(ext => delete extensions[ext]);
    }
  };

  /**
   * The module require method which should only be called by evaluating code.
   */
  require: {
    (id: string): any;
    resolve: (id: string) => string;
    ensure: () => void;
    cache: typeof cache;
  } = Object.assign(
    (id: string) => {
      if (id in builtins) {
        // The module is in the allowed list of builtin node modules
        // Ideally we should prevent importing them, but webpack polyfills some
        // So we check for the list of polyfills to determine which ones to support
        if (builtins[id as keyof typeof builtins]) {
          return require(id);
        }

        return null;
      }

      // Resolve module id (and filename) relatively to parent module
      const filename = this.resolve(id);

      if (filename === id && !path.isAbsolute(id)) {
        // The module is a builtin node modules, but not in the allowed list
        let e = new Error(
          `Unable to import "${id}". Importing Node builtins is not supported in the sandbox.`
        );
        // @ts-ignore
        e.code = 'REQUIRE';
        throw e;
      }

      this.dependencies.add(filename);

      let m = cache[filename];

      log(`resolving require for ${id}`);

      if (!m) {
        // Create the module if cached module is not available
        m = new Module(filename);
        m.transform = this.transform;
        log(`creating new module for ${id}`);

        // Store it in cache at this point, otherwise we would
        // end up in infinite loop with cyclic dependencies
        cache[filename] = m;

        this._loadFromFile(m, id);
      } else {
        // Is it still fresh?
        const lastModified = mtime(m.filename);
        if (lastModified > m.mtime) {
          m._loadFromFile(m, id);
        }
      }
      if (!m.loaded) {
        m.evaluate();
      }
      m.dependents && m.dependents.add(this.filename);
      return m.exports;
    },
    {
      ensure: NOOP,
      cache,
      resolve: this.resolve,
    }
  );

  /**
   * loadFromFile checks if the file has been modified.
   * If the file is JSON or not Javascript, it is evaluated. Otherwise, the file is transformed only.
   * Call m.evaluate() if m.loaded is false.
   */
  private _loadFromFile(m: Module, id: string) {
    if (this.extensions.includes(path.extname(m.filename))) {
      const lastModified = mtime(m.filename);
      let code: string;
      if (m._source && m.mtime === lastModified) {
        code = m._source;
      } else {
        m.mtime = lastModified;
        code = Module._fs.readFileSync(m.filename).toString();
      }
      // To evaluate the file, we need to read it first
      if (/\.json$/.test(m.filename)) {
        // For JSON files, parse it to a JS object similar to Node
        m.exports = JSON.parse(code);
        m.loaded = true;
      } else {
        // For JS/TS files, code should be evaluated after the transform
        // The module will be transpiled using provided transform
        m.loaded = false;
        m._transform({ code, map: null });
      }
    } else {
      // For non JS/JSON requires, just export the id
      // This is to support importing assets in webpack
      // The module will be resolved by css-loader
      m.exports = id;
      m.dependents = false;
      m.loaded = true;
    }
  }

  load() {
    try {
      this._loadFromFile(this, this.id);
    } catch (e) {
      e = this._prepareStack(e);
      throwOrQueue(e);
    }
  }

  /** For JavaScript files, we need to transpile it and to get the exports of the module */
  private _transform(codeAndMap: GeneratorResult): string {
    try {
      if (typeof codeAndMap.code !== 'string') {
        throw new Error('Linaria: Expected a string to evaluate');
      }
      this._source = codeAndMap.code;
      const transformed = this.transform
        ? this.transform(codeAndMap)
        : codeAndMap;
      if (typeof transformed.code !== 'string') {
        throw new Error(
          'Linaria: The compile function did not return a string.'
        );
      }
      return (this._transformed = transformed.code);
    } catch (e) {
      e.code = 'TRANSFORM';
      throw e;
    }
  }

  /** compiles the string and executes it in the sandbox context. Stores exports on this module. */
  evaluate(codeAndMap?: GeneratorResult, alwaysThrow?: boolean) {
    log(`evaluating ${this.filename}`);
    if (this.loaded) {
      return;
    }

    try {
      if (typeof codeAndMap !== 'undefined') {
        this._transform(codeAndMap);
      } else if (!this._transformed) {
        throw Error(`Module expected code on first evaluate.`);
      }

      log(`executing ${this.filename}`);

      const fn = vm.compileFunction(
        this._transformed!,
        ['exports', 'require', 'module', '__filename', '__dirname'],
        {
          parsingContext: sandbox,
          filename: this.filename,
        }
      );
      this._disposeQueue.forEach(exec);
      this._disposeQueue = [];
      fn(
        this.exports,
        this.require,
        this,
        this.filename,
        path.dirname(this.filename)
      );
    } catch (e) {
      // Clean Stack Trace as the evaluator can recurse deeply.
      e = this._prepareStack(e);
      throwOrQueue(e, alwaysThrow);
    } finally {
      log(`Finished loading ${this.filename}`);
      this.loaded = true;
    }
  }

  private _prepareStack(e: Error | { message: string; stack: string }) {
    try {
      const ATprefix = '    at ';
      e = fixError(e);
      let split: string[] = e.stack!.split('\n').reverse();
      const idx = split.findIndex(v =>
        v.includes(path.basename(this.filename))
      );
      if (idx === -1 || !split.length) {
        return e;
      }
      if (!split[idx].startsWith(ATprefix)) {
        split[idx] = ATprefix + split[idx];
      }
      split = split.slice(idx, split.length).reverse();
      // Parse stack trace to produce a pretty code frame
      let searchLineIdx = split.length - 1;
      let matches = split[searchLineIdx].match(StackFrameRe);
      if (matches) {
        let file = matches[1];
        let firstIndex = split.findIndex(value => value.includes(file));
        matches = split[firstIndex].match(StackFrameRe);
      }
      if (matches) {
        const line = parseInt(matches[2]);
        const column = parseInt(matches[3]);
        const firstTraceLineIdx = split.findIndex(v => /^\s+at /.test(v));
        const loc = {
          start: { line: line, column: column },
        };
        const cfOpts = {
          highlightCode: true,
          linesAbove: 2,
          linesBelow: 2,
          message: e.message,
        };
        const cached = compileCache.get()[this.filename];
        let sourceCode: string;
        if (cached && cached.map && cached.map.sourcesContent) {
          sourceCode = cached.map.sourcesContent[0] || this._source!;
        } else {
          sourceCode = this._source!;
        }
        const result: string =
          (sourceCode && codeFrameColumns(sourceCode, loc, cfOpts)) ||
          codeFrameColumns(this._transformed!, loc, cfOpts) ||
          e.message;
        e.stack = [
          '\nLinaria Preval Error:',
          result,
          '',
          split.slice(firstTraceLineIdx).join('\n'),
        ].join('\n');
      }
    } catch (err) {
      /*noop */
    }
    return e;
  }

  private _disposeQueue: Function[] = [];

  hot = {
    dispose: (fn: Function) => {
      this._disposeQueue.push(fn);
    },
  };
}

export default Module;

function exec(fn: Function) {
  try {
    fn();
  } catch (e) {
    /* noop */
  }
}

function throwOrQueue(e: any, alwaysThrow?: boolean) {
  if (
    alwaysThrow ||
    e.code === 'REQUIRE' ||
    e.code === 'RESOLVE' ||
    e.code === 'TRANSFORM'
  ) {
    writeAndFlushConsole();
    throw errorQueue.merge(e);
  } else {
    // These errors will not be printed until an evaluation fails.
    // In this way, modules that only contain side effects that access a browser-only global
    // will be ignored unless an actual preval error occurred.
    // errorQueue is flushed by throwIfInvalid
    errorQueue.push(e);
  }
}
