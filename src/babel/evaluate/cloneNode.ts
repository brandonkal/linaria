/**
 * This is identical to cloneNode exported by `@babel/types` with the addition of keeping a map of original node to cloned node.
 * This enables us to perform tree shaking on a seperate AST.
 */
import { types as t } from '@babel/core';
const NODE_FIELDS = t.NODE_FIELDS;

export const findCloned = new WeakMap();

const has = Function.call.bind(Object.prototype.hasOwnProperty);

function cloneIfNode(obj: any, deep: boolean) {
  if (
    obj &&
    typeof obj.type === 'string' &&
    // CommentLine and CommentBlock are used in File#comments, but they are
    // not defined in babel-types
    obj.type !== 'CommentLine' &&
    obj.type !== 'CommentBlock'
  ) {
    return cloneNode(obj, deep);
  }

  return obj;
}

function cloneIfNodeOrArray(obj: any, deep: boolean) {
  if (Array.isArray(obj)) {
    return obj.map(node => cloneIfNode(node, deep));
  }
  return cloneIfNode(obj, deep);
}

/**
 * Create a clone of a `node` including only properties belonging to the node.
 * If the second parameter is `false`, cloneNode performs a shallow clone.
 */
export default function cloneNode<T extends t.Node>(
  node: T,
  deep: boolean = true
): T {
  if (!node) return node;

  const { type } = node;
  const newNode = { type } as any;

  findCloned.set(node, newNode);

  // Special-case identifiers since they are the most cloned nodes.
  if (type === 'Identifier') {
    //@ts-ignore
    newNode.name = node.name;

    //@ts-ignore
    if (has(node, 'optional') && typeof node.optional === 'boolean') {
      //@ts-ignore
      newNode.optional = node.optional;
    }

    if (has(node, 'typeAnnotation')) {
      //@ts-ignore
      newNode.typeAnnotation = deep
        ? cloneIfNodeOrArray((node as any).typeAnnotation, true)
        : (node as any).typeAnnotation;
    }
  } else if (!has(NODE_FIELDS, type)) {
    throw new Error(`Unknown node type: "${type}"`);
  } else {
    for (const field of Object.keys(NODE_FIELDS[type])) {
      if (has(node, field)) {
        newNode[field] = deep
          ? cloneIfNodeOrArray((node as any)[field], true)
          : (node as any)[field];
      }
    }
  }

  if (has(node, 'loc')) {
    newNode.loc = node.loc;
  }
  if (has(node, 'leadingComments')) {
    newNode.leadingComments = node.leadingComments;
  }
  if (has(node, 'innerComments')) {
    newNode.innerComments = node.innerComments;
  }
  if (has(node, 'trailingComments')) {
    newNode.trailingComments = node.trailingComments;
  }
  if (has(node, 'extra')) {
    newNode.extra = {
      // @ts-ignore
      ...node.extra,
    };
  }

  return newNode as T;
}
