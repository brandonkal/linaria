let errorQueue: Error[] = [];

/**
 * Print all Error stacks in queue and flushes the queue.
 */
export function print() {
  const ret =
    'Errors encountered during Preval Evaluation. i.e. Side Effects\n' +
    errorQueue.map(e => e.stack).join('\n\n');
  flush();
  return ret;
}

export function flush() {
  errorQueue = [];
}

export function push(e: any) {
  errorQueue.push(e);
}

/**
 * Prepends an existing Error stack with the errorQueue stacks and flushes the queue.
 */
export function merge(e: Error) {
  e.stack = e.stack as string;
  const shouldPrependMessage = !e.stack.includes(e.message);
  const queueStack = print() + '\n\n';
  e.stack = queueStack + (shouldPrependMessage ? e.message : '') + e.stack;
  return e;
}
