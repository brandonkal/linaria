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
import * as sandboxProcess from './process';
import { BabelFileResult } from '@babel/core';
import { GeneratorResult } from '@babel/generator';
import debug from 'debug';
import { codeFrameColumns } from '@babel/code-frame';
import fixError from './utils/fixError';
import * as compileCache from './compileCache';
import * as errorQueue from './utils/errorQueue';
const log = debug('linaria:module');
import './sourceMapRegister';

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
let cache: { [id: string]: Module } = {};

const NOOP = () => {};

const vmGlobal = {
  URL,
  URLSearchParams,
  process: sandboxProcess,
  linariaVM: true,
  Buffer,
  console,
  setTimeout,
  clearTimeout,
  setImmediate,
  setInterval,
  clearInterval,
  // pass all errors through so instanceof works
  Error,
  TypeError,
  ReferenceError,
  URIError,
  EvalError,
  RangeError,
};

const sandbox = vm.createContext(
  {
    global: vmGlobal,
    ...vmGlobal,
    window: {},
  },
  {
    name: 'Linaria Preval',
  }
);

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

class Module {
  /**
   * Alias to resolve the module using node's resolve algorithm
   * This static property can be overriden by the webpack loader
   * This allows us to use webpack's module resolution algorithm
   */
  static _resolveFilename = (
    id: string,
    parent: { id: string; filename: string; paths: string[] }
  ) => {
    return ((NativeModule as any) as NM)._resolveFilename(id, parent);
  };

  static _nodeModulePaths = (filename: string) =>
    ((NativeModule as any) as NM)._nodeModulePaths(filename);

  static invalidateAll = () => {
    cache = {};
    compileCache.clear();
  };

  id: string;
  filename: string;
  paths: string[];
  exports: any;
  extensions: string[];
  dependencies: string[];
  transform: ((codeAndMap: GeneratorResult) => BabelFileResult) | null;
  /** A hash of the babel transform options */
  _cacheKey?: string;
  /** Represents the source as passed to evaluate. This may have already been transformed by the initial Linaria extraction. */
  private _source?: string;
  /* we store the code executed for when a source-map is unavailable. */
  private _transformed?: string;
  private _evaluated?: boolean;

  constructor(filename: string) {
    this.id = filename;
    this.filename = filename;
    this.paths = [];
    this.dependencies = [];
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

      this.dependencies.push(filename);

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

        if (this.extensions.includes(path.extname(filename))) {
          // To evaluate the file, we need to read it first
          const code = fs.readFileSync(filename, 'utf-8');

          if (/\.json$/.test(filename)) {
            // For JSON files, parse it to a JS object similar to Node
            m.exports = JSON.parse(code);
          } else {
            // For JS/TS files, evaluate the module
            // The module will be transpiled using provided transform
            m.evaluate({ code, map: null });
          }
        } else {
          // For non JS/JSON requires, just export the id
          // This is to support importing assets in webpack
          // The module will be resolved by css-loader
          m.exports = id;
        }
      }

      return m.exports;
    },
    {
      ensure: NOOP,
      cache,
      resolve: this.resolve,
    }
  );

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
  evaluate(codeAndMap: GeneratorResult, alwaysThrow?: boolean) {
    log(`evaluating ${this.filename}`);
    if (this._evaluated) {
      return;
    }

    try {
      const compiled = this._transform(codeAndMap);

      log(`executing ${this.filename}`);

      const fn = vm.compileFunction(
        compiled,
        ['exports', 'require', 'module', '__filename', '__dirname'],
        {
          parsingContext: sandbox,
          filename: this.filename,
        }
      );
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
      if (
        alwaysThrow ||
        e.code === 'REQUIRE' ||
        e.code === 'RESOLVE' ||
        e.code === 'TRANSFORM'
      ) {
        throw e;
      } else {
        // These errors will not be printed until an evaluation fails.
        // In this way, modules that only contain side effects that access a browser-only global
        // will be ignored unless an actual preval error occurred.
        // errorQueue is flushed by throwIfInvalid
        errorQueue.push(e);
      }
    } finally {
      this._evaluated = true;
    }
  }

  private _prepareStack(e: Error | { message: string; stack: string }) {
    try {
      e = fixError(e);
      let split: string[] = e.stack!.split('\n').reverse();
      const idx = split.findIndex(v =>
        v.includes(path.basename(this.filename))
      );
      if (idx === -1 || !split.length) {
        return e;
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
        const firstTraceLineIdx = split.findIndex(v => v.startsWith('    at '));
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
          split.slice(firstTraceLineIdx).join('\n'),
        ].join('\n');
      }
    } catch (err) {
      /*noop */
    }
    return e;
  }
}

export default Module;
