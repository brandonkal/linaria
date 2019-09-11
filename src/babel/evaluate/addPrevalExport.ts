import { types as t } from '@babel/core';

/**
 * All exported values will be wrapped with this function
 * fn => { try { return fn(); } catch (e) { return e; } };
 */
const expWrapper = t.arrowFunctionExpression(
  [t.identifier('fn')],
  t.blockStatement([
    t.tryStatement(
      t.blockStatement([
        t.returnStatement(t.callExpression(t.identifier('fn'), [])),
      ]),
      t.catchClause(
        t.identifier('e'),
        t.blockStatement([t.returnStatement(t.identifier('e'))])
      )
    ),
  ])
);

const linariaWrapIdentifier = t.identifier('_linariaWrap');

const wrapper = t.variableDeclaration('const', [
  t.variableDeclarator(linariaWrapIdentifier, expWrapper),
]);

export default function addPrevalExport(
  expressions: t.Expression[],
  program: t.Program
) {
  let nodesAdded: t.Statement[] = [];
  const forExport = expressions
    // … and wrap it with the function
    .map(ex =>
      t.callExpression(linariaWrapIdentifier, [
        t.arrowFunctionExpression([], ex, false),
      ])
    );
  if (forExport.length) {
    // Add wrapper function definition
    program.body.push(wrapper);
    nodesAdded.push(wrapper);
  }

  const exported = t.exportNamedDeclaration(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('__linariaPreval'),
        t.arrayExpression(forExport)
      ),
    ]),
    []
  );
  nodesAdded.push(exported);

  // Add export of all evaluated expressions
  program.body.push(exported);
  return nodesAdded;
}
