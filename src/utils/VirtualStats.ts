import { Stats } from 'fs';
/**
 * Used to cache a stats object for the virtual file.
 * ES6 update (c) 2019 Brandon Kalinowski. MIT.
 * VirtualStats class extracted from the `mock-fs` package.
 * @link https://github.com/tschaub/mock-fs/blob/master/license.md
 */

import constants from 'constants';

let inode = 45000000;

interface StatsConfig {
  size: number;
  mtime?: Date | number | string;
}

/**
 * Create a new stats object.
 */
class VirtualStats implements Stats {
  dev = 8675309;
  nlink = 0;
  uid = 1000;
  gid = 1000;
  rdev = 0;
  blksize = 4096;
  ino = inode++;
  mode = 33188;
  size: number;
  blocks: number;
  atime: Date;
  atimeMs: number;
  mtime: Date;
  mtimeMs: number;
  ctime: Date;
  ctimeMs: number;
  birthtime: Date;
  birthtimeMs: number;
  constructor({ size, mtime = new Date() }: StatsConfig) {
    if (!(mtime instanceof Date)) {
      mtime = new Date(mtime);
    }
    const ms = mtime.getTime();
    this.size = size;
    this.blocks = Math.floor(size / 4096);
    this.atime = mtime;
    this.mtime = mtime;
    this.ctime = mtime;
    this.birthtime = mtime;
    this.atimeMs = ms;
    this.ctimeMs = ms;
    this.mtimeMs = ms;
    this.birthtimeMs = ms;
  }
  _checkModeProperty(property: number): boolean {
    return (this.mode & constants.S_IFMT) === property;
  }
  isDirectory(): boolean {
    return this._checkModeProperty(constants.S_IFDIR);
  }
  isFile(): boolean {
    return this._checkModeProperty(constants.S_IFREG);
  }
  isBlockDevice(): boolean {
    return this._checkModeProperty(constants.S_IFBLK);
  }
  isCharacterDevice(): boolean {
    return this._checkModeProperty(constants.S_IFCHR);
  }
  isFIFO(): boolean {
    return this._checkModeProperty(constants.S_IFIFO);
  }
  isSymbolicLink(): boolean {
    return this._checkModeProperty(constants.S_IFLNK);
  }
  isSocket(): boolean {
    return this._checkModeProperty(constants.S_IFSOCK);
  }

  toJSON() {
    return {
      mtimeMs: this.mtime,
    };
  }
}

export default VirtualStats;
