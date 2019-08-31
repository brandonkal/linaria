import { types } from '@babel/core';
import { NodePath } from '@babel/traverse';
import syntax from '@babel/plugin-syntax-dynamic-import';

// NOTE: referenced by babel/evaluate/index.ts
export default function dynamic({ types: t }: { types: typeof types }) {
  const noop = t.arrowFunctionExpression([], t.identifier('undefined'));
  return {
    inherits: syntax,
    visitor: {
      Import(path: NodePath<types.Import>) {
        path.parentPath.replaceWith(
          t.objectExpression([
            t.objectProperty(t.identifier('then'), noop),
            t.objectProperty(t.identifier('catch'), noop),
          ])
        );
      },
    },
  };
}
