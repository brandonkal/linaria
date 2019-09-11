import sourceMapSupport from 'source-map-support';
import * as compileCache from './compileCache';

// Register additional source map support for vm.
sourceMapSupport.install({
  handleUncaughtExceptions: false,
  environment: 'node',
  retrieveSourceMap: linariaRetrieveSourceMap,
});

function linariaRetrieveSourceMap(filename: string) {
  const cached = compileCache.get()[filename];
  if (cached && cached.map) {
    return {
      url: filename,
      map: cached.map as any,
    };
  } else {
    return null;
  }
}
