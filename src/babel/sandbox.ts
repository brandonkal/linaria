import vm from 'vm';
import vmConsole from './console';

const noop = () => {};
const vmProcess = Object.freeze({
  nextTick: (fn: Function) => setTimeout(fn, 0),
  platform: 'browser',
  arch: 'browser',
  execPath: 'browser',
  title: 'browser',
  pid: 1,
  browser: true,
  argv: [],
  binding: function binding() {
    /* istanbul ignore next */
    throw new Error('No such module. (Possibly not yet loaded)');
  },
  cwd: () => '/',
  exit: noop,
  kill: noop,
  chdir: noop,
  umask: noop,
  dlopen: noop,
  uptime: noop,
  memoryUsage: noop,
  uvCounters: noop,
  features: {},

  env: Object.freeze({
    NODE_ENV: process.env.NODE_ENV,
    isVM: true,
    DEBUG: process.env.DEBUG,
  }),
});

function makeGlobal() {
  vmConsole._reset();
  const vmGlobal = Object.assign(
    {},
    {
      URL,
      URLSearchParams,
      process: vmProcess,
      linariaVM: true,
      Buffer: Buffer,
      console: vmConsole,
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
    }
  );
  return vmGlobal;
}

export const context = () => {
  const vmGlobal = makeGlobal();
  return {
    global: vmGlobal,
    ...vmGlobal,
    window: {},
  };
};

export const createSandbox = () => {
  return vm.createContext(context(), {
    name: 'Linaria Preval',
  });
};
