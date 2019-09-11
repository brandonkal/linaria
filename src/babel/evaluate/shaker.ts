import { types as t } from '@babel/core';
import build from './graphBuilder';
import { ExternalDep } from './DepsGraph';
import isNode from '../utils/isNode';
import getVisitorKeys from '../utils/getVisitorKeys';
import dumpNode from './dumpNode';
import cloneNode, { findCloned } from './cloneNode';
import addPrevalExport from './addPrevalExport';

/*
 * Returns new tree without dead nodes
 */
function shakeNode<TNode extends t.Node>(
  node: TNode,
  alive: Set<t.Node>
): TNode {
  const keys = (getVisitorKeys(node) as unknown) as (keyof TNode)[];
  const changes: Partial<TNode> = {};

  for (const key of keys) {
    const subNode = node[key];

    if (Array.isArray(subNode)) {
      const list: any = [];
      let hasChanges = false;
      for (let i = 0; i < subNode.length; i++) {
        const child = subNode[i];
        const isAlive = alive.has(child);
        hasChanges = hasChanges || !isAlive;
        if (child && isAlive) {
          const shaken = shakeNode(child, alive);
          if (shaken) {
            list.push(shaken);
          }

          hasChanges = hasChanges || shaken !== child;
        }
      }
      if (hasChanges) {
        changes[key] = list;
      }
    } else if (isNode(subNode) && alive.has(subNode)) {
      const shaken = shakeNode(subNode, alive);
      if (shaken && shaken !== subNode) {
        changes[key] = shaken;
      }
    }
  }

  return Object.keys(changes).length ? { ...node, ...changes } : node;
}

/*
 * Gets AST and a list of nodes for evaluation
 * Removes unrelated “dead” code.
 * Adds to the end of module export of array of evaluated values or evaluation errors.
 * Returns new AST and an array of external dependencies.
 */
export default function shake(
  rootNode: t.Program,
  nodes: Array<t.Expression | string>,
  generateNewAst = true
): [t.Program, ExternalDep[]] {
  let program = generateNewAst ? cloneNode(rootNode) : rootNode;
  const depsGraph = build(program);
  const clonedNodes = generateNewAst
    ? nodes.map(node =>
        typeof node === 'string' ? node : findCloned.get(node)
      )
    : nodes;
  const topLevelDeps = depsGraph.getLeafs(clonedNodes);

  const alive = depsGraph.getAlive(topLevelDeps);

  depsGraph.exports.forEach(exp => shakeNode(exp, alive));

  const shaken = shakeNode(program, alive) as t.Program;
  /*
   * If we want to know what is really happened with our code tree, we can print formatted tree here by setting env DEBUG=linaria:shaker
   */
  dumpNode(program, alive);

  addPrevalExport(topLevelDeps, shaken);

  return [
    shaken,
    depsGraph.externalDeps.filter(({ local }) => alive.has(local)),
  ];
}
