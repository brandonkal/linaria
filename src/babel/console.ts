import { BufferedConsole, getConsoleOutput, LogType } from '@jest/console';
import callsites, { CallSite } from 'callsites';
import { SourceMapConsumer } from 'source-map';
import { linariaRetrieveSourceMap } from './sourceMapRegister';

// Copied from https://github.com/rexxars/sourcemap-decorate-callsites/blob/5b9735a156964973a75dc62fd2c7f0c1975458e8/lib/index.js#L113-L158
const decorateCallSite = (
  callsite: callsites.CallSite,
  consumer: SourceMapConsumer
) => {
  const getLineNumber = callsite.getLineNumber;
  const getColumnNumber = callsite.getColumnNumber;
  let position: ReturnType<typeof consumer.originalPositionFor> | null = null;

  function getPosition() {
    if (!position) {
      position = consumer.originalPositionFor({
        column: getColumnNumber.call(callsite) || -1,
        line: getLineNumber.call(callsite) || -1,
      });
    }

    return position;
  }

  Object.defineProperties(callsite, {
    getColumnNumber: {
      value() {
        return getPosition().column || getColumnNumber.call(callsite);
      },
      writable: false,
    },
    getLineNumber: {
      value() {
        return getPosition().line || getLineNumber.call(callsite);
      },
      writable: false,
    },
  });
};

function getCallSite(level: number) {
  const levelAfterThisCall = level + 1;
  const stack = callsites()[levelAfterThisCall];
  return stack;
}

interface hasCallSite {
  callsite: CallSite;
}

function wrapCallSites(stacks: hasCallSite[]): hasCallSite[] {
  const cachedConsumers = new WeakMap();
  function getConsumer(map: any) {
    let consumer = cachedConsumers.get(map);
    if (!consumer) {
      consumer = new SourceMapConsumer(map);
      cachedConsumers.set(map, consumer);
    }
    return consumer;
  }
  stacks.forEach(stack => {
    const filename = stack.callsite.getFileName();
    if (filename) {
      const source = linariaRetrieveSourceMap(filename);

      if (source && source.map) {
        try {
          decorateCallSite(stack.callsite, getConsumer(source.map));
        } catch (e) {
          // ignore
        }
      }
    }
  });
  return stacks;
}

BufferedConsole.write = function(buffer, type, message, level) {
  buffer.push({
    message,
    // @ts-ignore -- no clean way to override type here
    callsite: getCallSite(level != null ? level : 2),
    type,
  });
  return buffer;
};

export class LinariaBufferedConsole extends BufferedConsole {
  getBuffer() {
    if ((this as any)._buffer.length) {
      const buf = (this as any)._buffer as IntermediateLogEntry[];
      wrapCallSites(buf);
      return buf.map(({ callsite, type, message }) => {
        const origin = callsite.getFileName() + ':' + callsite.getLineNumber();
        return {
          type,
          message,
          origin,
        };
      });
    }
    return undefined;
  }
  _reset() {
    (this as any)._buffer = [];
    (this as any).counters = {};
    (this as any)._timers = {};
    (this as any)._groupDepth = 0;
  }
}

const vmConsole = new LinariaBufferedConsole(() => undefined);

interface IntermediateLogEntry {
  message: string;
  callsite: CallSite;
  type: LogType;
}

export default vmConsole;

export function writeAndFlushConsole() {
  const buf = vmConsole.getBuffer();
  if (buf && process.stderr) {
    process.stderr.write(
      'LINARIA module evaluation console output since last error:\n\n.'
    );
    const consoleOutput = getConsoleOutput('', false, buf);
    vmConsole._reset();
    process.stdout.write(consoleOutput);
  }
}
