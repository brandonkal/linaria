/**
 * Compile Cache implementation based on code from @babel/register:
 * Modifications Copyright (c) 2019 Brandon Kalinowski
 * MIT. Copyright (c) 2014-present Sebastian McKenzie and other contributors.
 */

// Transformed module cache to persist on disk

import path from 'path';
import fs from 'fs';
import os from 'os';
import { sync as mkdirpSync } from 'mkdirp';
import findCacheDir from 'find-cache-dir';

import pkg from '../../package.json';
import { GeneratorResult } from '@babel/generator';
const VERSION = pkg.version;

const DEFAULT_CACHE_DIR =
  findCacheDir({ name: '@brandonkal/linaria' }) || os.homedir() || os.tmpdir();
const DEFAULT_FILENAME = path.join(
  DEFAULT_CACHE_DIR,
  `.linariaCompileCache.json`
);
const FILENAME: string = process.env.LINARIA_CACHE_PATH || DEFAULT_FILENAME;
let cache: {
  version: string;
  data: Record<string, CachedCompilation>;
} = {
  version: VERSION,
  data: {},
};

interface CachedCompilation extends GeneratorResult {
  optsHash: string;
  mtime: number;
}

/**
 * Write stringified cache to disk.
 */
export function save() {
  let serialized = JSON.stringify({ version: VERSION, data: {} });

  try {
    serialized = JSON.stringify(cache, null, '  ');
  } catch (err) {
    if (err.message === 'Invalid string length') {
      err.message = "Cache too large so it's been cleared.";
      // eslint-disable-next-line
      console.error(err.stack);
    } else {
      throw err;
    }
  }

  mkdirpSync(path.dirname(FILENAME));
  fs.writeFileSync(FILENAME, serialized);
}

/**
 * Load cache from disk and parse.
 */
export function load() {
  if (process.env.LINARIA_DISABLE_CACHE) return;

  process.on('exit', save);
  process.nextTick(save);

  if (!fs.existsSync(FILENAME)) return;

  try {
    cache = JSON.parse(fs.readFileSync(FILENAME, 'utf8'));
    if (cache.version !== VERSION) {
      cache = { version: VERSION, data: {} };
    }
  } catch (err) {
    return;
  }
}

/**
 * Retrieve data from cache.
 */
export function get() {
  return cache.data;
}

/**
 * Clear the cache object.
 */
export function clear() {
  cache = { version: VERSION, data: {} };
  process.nextTick(save);
}
