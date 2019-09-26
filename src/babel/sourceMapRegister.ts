import sourceMapSupport from 'source-map-support';
import * as compileCache from './compileCache';

let activated = false;

// Register additional source map support for vm.
activate();

function activate() {
  if (activated) return;
  sourceMapSupport.install({
    handleUncaughtExceptions: false,
    environment: 'node',
    retrieveSourceMap: linariaRetrieveSourceMap,
  });
  activated = true;
}

export function linariaRetrieveSourceMap(filename: string) {
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
