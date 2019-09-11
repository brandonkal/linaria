import { makeModule } from '../module';
import memoize from 'memoize-one';

function hasImport(
  t: any,
  scope: any,
  filename: string,
  identifier: string,
  canonicalSource: string
): boolean {
  const binding = scope.getAllBindings()[identifier];

  if (!binding) {
    return false;
  }

  const p = binding.path;

  function isImportingModule(value: string) {
    // If the value is an exact match, assume it imports the module
    if (value === canonicalSource) {
      return true;
    }
    // Otherwise, resolve both and check if the file path is the same.
    const m = makeModule(filename);
    const resolveFromFile = (id: string) => {
      try {
        return m.resolve(id);
      } catch (e) {
        return;
      }
    };
    return (
      resolveFromFile(value) ===
      // eslint-disable-next-line no-nested-ternary
      (canonicalSource === '@brandonkal/linaria'
        ? require.resolve('../../index')
        : canonicalSource === '@brandonkal/linaria/react'
        ? require.resolve('../../react/')
        : resolveFromFile(canonicalSource))
    );
  }

  if (t.isImportSpecifier(p) && t.isImportDeclaration(p.parentPath)) {
    return isImportingModule(p.parentPath.node.source.value);
  }

  if (t.isVariableDeclarator(p)) {
    if (
      t.isCallExpression(p.node.init) &&
      t.isIdentifier(p.node.init.callee) &&
      p.node.init.callee.name === 'require' &&
      p.node.init.arguments.length === 1
    ) {
      const node = p.node.init.arguments[0];

      if (t.isStringLiteral(node)) {
        return isImportingModule(node.value);
      }

      if (t.isTemplateLiteral(node) && node.quasis.length === 1) {
        return isImportingModule(node.quasis[0].value.cooked);
      }
    }
  }

  return false;
}

/** Verify if the binding is imported from the specified source */
export default memoize(hasImport);
