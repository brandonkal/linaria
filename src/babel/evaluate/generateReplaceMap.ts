import { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import throwIfInvalid from '../utils/throwIfInvalid';
import stripLines from '../utils/stripLines';
import toCSS from '../utils/toCSS';
import isStyled from '../utils/isStyled';
import { Value } from '../types';
import { isValidElementType } from 'react-is';

// Dummy location as lines have already been stripped.
const dummyLoc = {
  start: { line: 0, column: 0 },
  end: { line: 0, column: 0 },
};

export default function generateReplaceMap(
  lazyValues: Value[],
  nodeFromString: Map<string, NodePath<t.Expression>>
) {
  const valueFromString = (key: string) => {
    return lazyValues[parseInt(key.replace('LINARIA_PREVAL_', ''))];
  };
  return (key: string, wrapCls?: string) => {
    // Fetch the node from the original Javascript for Code Frames.
    const node = nodeFromString.get(key);
    let value = valueFromString(key);
    if (node == null) {
      throw new Error('Linaria CSS error: lazyValue is missing');
    } else {
      throwIfInvalid(value, node);
    }

    let replacement: string;

    if (wrapCls) {
      // If `styled` wraps another component and not a primitive,
      // get its class name to create a more specific selector
      // it'll ensure that styles are overridden properly
      let val = value as any;
      while (isValidElementType(val) && (val as any).__linaria) {
        wrapCls += `.${(val as any).__linaria.className}`;
        val = (val as any).__linaria.extends;
      }
      return wrapCls;
    }

    if (isStyled(value)) {
      // If it's an React component wrapped in styled, get the class name
      // Useful for interpolating components
      replacement = `.${value.__linaria.className}`;
    } else if (value && (value as any).cls) {
      replacement = stripLines(dummyLoc, toCSS((value as any).cls));
    } else {
      replacement = stripLines(
        dummyLoc,
        toCSS(value as string /* function not possible here */)
      );
    }
    return replacement;
  };
}
