/* istanbul ignore file */
import { types } from '@babel/core';
import debug from 'debug';
const log = debug('linaria:shaker');

type Hooks = {
  [key: string]: (node: any) => string | number;
};

const hooks: Hooks = {
  Identifier: (node: types.Identifier) => node.name,
  BinaryExpression: (node: types.BinaryExpression) => node.operator,
  NumericLiteral: (node: types.NumericLiteral) => node.value,
  StringLiteral: (node: types.StringLiteral) => node.value,
};

function isNode(obj: any): obj is types.Node {
  return !!obj;
}

export default function dumpNode<T extends types.Node>(
  node: T,
  alive: Set<types.Node> | null = null,
  level = 0,
  idx: number | null = null
) {
  if (!log.enabled) {
    return;
  }
  const prefix =
    level === 0
      ? ''
      : `${'| '.repeat(level - 1)}${idx === null ? '|' : idx}${
          (idx || 0) < 10 ? '=' : ''
        }`;

  const { type } = node;
  const suffix = alive ? (alive.has(node) ? ' ✅' : ' ❌') : '';
  log(
    `${prefix}${type}${type in hooks ? ` ${hooks[type](node)}` : ''}${suffix}`
  );

  // log('\n');
  const keys = types.VISITOR_KEYS[type] as Array<keyof T>;
  for (const key of keys) {
    const subNode = node[key];

    log(`${'| '.repeat(level)}|-${key}`);
    if (Array.isArray(subNode)) {
      for (let i = 0; i < subNode.length; i++) {
        const child = subNode[i];
        if (child) dumpNode(child, alive, level + 2, i);
      }
    } else if (isNode(subNode)) {
      dumpNode(subNode, alive, level + 2);
    }
  }
}
