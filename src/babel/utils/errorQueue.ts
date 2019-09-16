let errorQueue: Error[] = [];

/**
 * Print all Error stacks in queue and flush the queue.
 */
export function print() {
  const ret =
    '\nErrors encoundered during Preval Evaluation. i.e. Side Effects\n' +
    errorQueue.map(e => e.stack).join('\n');
  errorQueue = [];
  return ret;
}

export function flush() {
  errorQueue = [];
}

export function push(e: any) {
  errorQueue.push(e);
}
