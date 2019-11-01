import vm from 'vm';
import vmConsole from './console';
import jsdom from 'jsdom';

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
  const window = createDOM();
  const vmGlobal = Object.assign(
    {},
    {
      window: window,
      ...window,
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
  };
};

export const createSandbox = () => {
  return vm.createContext(context(), {
    name: 'Linaria Preval',
  });
};

function createDOM() {
  const virtualConsole = new jsdom.VirtualConsole();
  virtualConsole.sendTo(vmConsole, {
    omitJSDOMErrors: true,
  });

  const dom = new jsdom.JSDOM(
    `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>React App</title>
  </head>
  <body>
    <noscript>
      You need to enable JavaScript to run this app.
    </noscript>
    <div id="root"></div>
  </body>
  </html>
  `,
    {
      runScripts: 'outside-only',
      virtualConsole: virtualConsole,
      url: 'http://localhost:8080',
    }
  );

  return dom.window;
}
