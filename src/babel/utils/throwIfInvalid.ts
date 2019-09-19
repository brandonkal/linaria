import generator from '@babel/generator';
import isSerializable from './isSerializable';
import { NodePath } from '@babel/traverse';
import isStyled from './isStyled';
import * as errorQueue from '../utils/errorQueue';

function isValid(value: any) {
  return !!(
    isStyled(value) ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (value &&
      (typeof value.cls === 'string' ||
        (Object.keys(value).length && isSerializable(value))))
  );
}

/** builds an alternative to node that allows us to serialize and cache to disk. */
// function buildNodeProxy(ex: NodePath, filename: string) {
//   const loc = ex.node.loc;
//   const code = '';
//   // const filename = ex.
//   const opts = {
//     start: {
//       line: loc.start.line,
//       column: loc.start.column + 1,
//     },
//   };
//   ex.getSource();
//   const stringified = generator(ex.node).code;
// }

/**
 * Throw if we can't handle the interpolated value.
 */
function throwIfInvalid(
  value: any,
  ex: NodePath,
  allowFn = false,
  circularHint = false
): void | never {
  if (isValid(value)) {
    return;
  }
  if (allowFn && typeof value === 'function') {
    return;
  }

  let thisError = buildError();
  function buildError() {
    // We can't use instanceof here so let's use duck typing
    if (value && value.stack && value.message) {
      const errMsg =
        `Linaria: An error occurred when evaluating the expression: ${value.message}.\n` +
        'Make sure you are not using a browser or Node specific API.';
      if (ex.buildCodeFrameError) {
        return ex.buildCodeFrameError(errMsg);
      }
      return new Error(errMsg);
    }

    const stringified =
      typeof value === 'object' ? JSON.stringify(value) : String(value);

    const errMsg =
      `\nLinaria: The expression evaluated to '${stringified}', which is probably a mistake.\n` +
      (circularHint && typeof value === 'undefined'
        ? 'This is likely the result of using a circular import.\n'
        : '') +
      `If you want it to be inserted into CSS, explicitly cast or transform the value to a string, e.g. - 'String(${
        generator(ex.node).code
      })'.`;

    if (ex.buildCodeFrameError) {
      return ex.buildCodeFrameError(errMsg);
    }
    return new Error(errMsg);
  }

  thisError.stack += errorQueue.print();
  throw thisError;
}

export default throwIfInvalid;
