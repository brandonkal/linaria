/* eslint-disable-next-line */
import { Compiler } from 'webpack';
/* eslint-disable-next-line */
import { ReplaceSource } from 'webpack-sources';
import makeTinyId from './utils/tinyId';

const NAME = 'linaria-optimize-classnames';

const COMMENT_REGEX = /LINARIA_.*?_LINARIA/g;
// const WRAP_REGEX = /(?:^LINARIA_|_LINARIA$)/g;
// const ID_REGEX = /^(?:[a-z0-9]+)/;
// const MODIFIER_RE = /__(?:\w|-)+_/;
/**
 * SCHEMA:
 * c19oj5n < component classes contain no dash or underscore.
 * c19oj5n-0 < CSS variables end in -number
 * cvg8y9q__not-large_0 < modifier classes end in _number
 */

interface LinariaPluginOptions {
  exclude?: RegExp;
  prefix?: string;
}

/**
 * Linaria className optimization plugin.
 * Takes compiled assets and replaces classNames with optimized tiny identifiers.
 */
export default class LinariaOptimize {
  classes: string[] = [];
  filesToUpdate = new Map<any, Set<string>>();
  exclude: RegExp;
  prefix: string;
  tinyId: (str: string) => string;

  constructor({
    exclude = /node_modules/,
    prefix = '',
  }: LinariaPluginOptions = {}) {
    this.exclude = exclude;
    this.prefix = prefix;
    this.tinyId = makeTinyId({ prefix, optimize: true });
  }

  apply(compiler: Compiler) {
    /** A map of modules to a list of matched classNames in the source. */
    this.classes = [];

    compiler.hooks.thisCompilation.tap(NAME, compilation => {
      compilation.hooks.optimizeChunkAssets.tap(NAME, chunks => {
        // Register all chunks
        chunks.forEach(chunk => {
          chunk.files.forEach(file => {
            let src = compilation.assets[file];
            if (src) {
              src = src.source();
            }
            if (!src || !src.includes('LINARIA_')) {
              return;
            }
            this.addMatches(file, src);
          });
        });
        // Run through all and replace
        let classes = Array.from(new Set([...this.classes])).sort();
        classes.forEach(cls => {
          this.tinyId(cls);
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
                  this.tinyId(match)
                );
                return m;
              });
            }
          });
          compilation.assets[file] = newSource;
        });
      });
    });
    compiler.hooks.done.tap(NAME, () => {
      this.classes = [];
    });
  }

  private addMatches(file: any, src: string) {
    if (src) {
      let matches = src.match(COMMENT_REGEX);
      if (matches) {
        this.classes.push(...matches);
        this.filesToUpdate.set(file, new Set([...matches]));
      }
    }
  }
}

// Node support
module.exports = LinariaOptimize;
