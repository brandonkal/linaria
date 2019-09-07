import generator from '@babel/generator';
import isSerializable from './isSerializable';
import { Serializable } from '../types';
import { NodePath } from '@babel/traverse';
import isStyled from './isStyled';

/** Throw if we can't handle the interpolated value */
function throwIfInvalid(value: Function, ex: NodePath): void;
function throwIfInvalid(value: string, ex: NodePath): void;
function throwIfInvalid(value: number, ex: NodePath): void;
function throwIfInvalid(value: Serializable, ex: NodePath): void;
function throwIfInvalid(value: any, ex: NodePath): never;
function throwIfInvalid(value: any, ex: NodePath): void | never {
  if (
    isStyled(value) ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (value && typeof value.cls === 'string') ||
    isSerializable(value)
  ) {
    return;
  }

  // We can't use instanceof here so let's use duck typing
  if (value && value.stack && value.message) {
    const errMsg =
      `An error occurred when evaluating the expression: ${value.message}.\n` +
      'Make sure you are not using a browser or Node specific API.';
    if (ex.buildCodeFrameError) {
      throw ex.buildCodeFrameError(errMsg);
    }
    throw Error(errMsg);
  }

  const stringified =
    typeof value === 'object' ? JSON.stringify(value) : String(value);

  const errMsg =
    `The expression evaluated to '${stringified}', which is probably a mistake.\n` +
    `If you want it to be inserted into CSS, explicitly cast or transform the value to a string, e.g. - 'String(${
      generator(ex.node).code
    })'.`;

  if (ex.buildCodeFrameError) {
    throw ex.buildCodeFrameError(errMsg);
  }
  throw Error(errMsg);
}

export default throwIfInvalid;
