export const nextTick = (fn: Function) => setTimeout(fn, 0);

export const platform = 'browser';
export const arch = 'browser';
export const execPath = 'browser';
export const title = 'browser';
export const pid = 1;
export const browser = true;
export const argv = [];

export const binding = function binding() {
  /* istanbul ignore next */
  throw new Error('No such module. (Possibly not yet loaded)');
};

export const cwd = () => '/';

const noop = () => {};
export const exit = noop;
export const kill = noop;
export const chdir = noop;
export const umask = noop;
export const dlopen = noop;
export const uptime = noop;
export const memoryUsage = noop;
export const uvCounters = noop;
export const features = {};

export const env = {
  NODE_ENV: process.env.NODE_ENV,
  isVM: true,
  DEBUG: process.env.DEBUG,
};

export const stderr = process.stderr;
export const stdout = process.stdout;
