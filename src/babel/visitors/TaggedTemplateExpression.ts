/* eslint-disable no-param-reassign */

import { basename, dirname, relative } from 'path';
import { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import throwIfInvalid from '../utils/throwIfInvalid';
import hasImport from '../utils/hasImport';
import { State, StrictOptions, ValueType, ExpressionValue } from '../types';

import toValidCSSIdentifier from '../utils/toValidCSSIdentifier';
import slugify from '../../utils/slugify';
import getLinariaComment from '../utils/getLinariaComment';
import calcExpressionStats from '../utils/calcExpressionStats';

import debug from 'debug';
const log = debug('linaria:traverse');

function makeArrow(ex: NodePath<t.Expression>, propsName = 'props') {
  let loc = ex.node.loc;
  let ident = t.identifier(propsName);
  let fn = t.arrowFunctionExpression([ident], ex.node);
  fn.loc = loc;
  ex.replaceWith(fn);
}

/**
 * Test to see whether an interpolation accesses a given prop object.
 */
function hasProp(ex: NodePath, propsName: string) {
  if (
    !propsName ||
    t.isIdentifier(ex.node) ||
    !ex.getSource().includes(propsName)
  ) {
    return false;
  }
  let shouldArrowIt = false;
  if (
    t.isMemberExpression(ex.node) &&
    t.isIdentifier(ex.node.object) &&
    ex.node.object.name === propsName
  ) {
    return true;
  }
  const memberVisitor = {
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (
        !shouldArrowIt &&
        t.isIdentifier(path.node.object) &&
        path.node.object.name === propsName
      ) {
        shouldArrowIt = true;
      }
    },
  };
  ex.traverse(memberVisitor);
  return shouldArrowIt;
}

export default function TaggedTemplateExpression(
  path: NodePath<t.TaggedTemplateExpression>,
  state: State,
  options: StrictOptions
) {
  const { tag } = path.node;

  let styled:
    | {
        component: NodePath<t.Expression> | { node: t.StringLiteral };
      }
    | undefined;
  let css = false;
  let isGlobal = false;

  if (
    t.isCallExpression(tag) &&
    t.isIdentifier(tag.callee) &&
    tag.arguments.length === 1 &&
    tag.callee.name === 'styled' &&
    hasImport(
      t,
      path.scope,
      state.file.opts.filename,
      'styled',
      '@brandonkal/linaria/react'
    )
  ) {
    const tagPath = path.get('tag') as NodePath<t.CallExpression>;
    styled = {
      component: tagPath.get('arguments')[0] as NodePath<t.Expression>,
    };
  } else if (
    t.isMemberExpression(tag) &&
    t.isIdentifier(tag.object) &&
    t.isIdentifier(tag.property) &&
    tag.object.name === 'styled' &&
    hasImport(
      t,
      path.scope,
      state.file.opts.filename,
      'styled',
      '@brandonkal/linaria/react'
    )
  ) {
    styled = {
      component: { node: t.stringLiteral(tag.property.name) },
    };
  } else if (
    hasImport(
      t,
      path.scope,
      state.file.opts.filename,
      'css',
      '@brandonkal/linaria'
    )
  ) {
    css = t.isIdentifier(tag) && tag.name === 'css';
  } else if (
    hasImport(
      t,
      path.scope,
      state.file.opts.filename,
      'injectGlobal',
      '@brandonkal/linaria'
    )
  ) {
    isGlobal = t.isIdentifier(tag) && tag.name === 'injectGlobal';
  }

  if (!styled && !css && !isGlobal) {
    log('no linaria import found. Skipping traverse.');
    return;
  }

  let propsName = 'props';
  let parentWasArrow = false;

  if (path.state) {
    propsName = path.state.propsName;
    parentWasArrow = path.state.parentWasArrow;
  }

  /**
   *  Transform Styled Components wrapped in an arrow function:
   * `const A = props => styled.a` becomes `const A = styled.a`
   */
  const parentIsArrow = styled && t.isArrowFunctionExpression(path.parentPath);

  // Remove Arrow Function Wrapper
  if (!parentWasArrow && parentIsArrow) {
    log('collapsing styled component arrow wrapper');
    const params = path.parentPath.get('params') as any[];
    if (!params || params.length !== 1) {
      throw path.parentPath.buildCodeFrameError(
        'Styled component arrow function can only accept one argument or things may break from rewrite.\n' +
          'If this is not an error, wrap it in another arrow function:\n' +
          'const Button = config => (props => styled.button``)({})'
      );
    }
    const param = params[0];
    if (!t.isIdentifier(param.node)) {
      throw param.buildCodeFrameError(
        'Unexpected element. Expected props argument name. Rest spread and destructuring are not supported here.'
      );
    }
    // Ensure arrow function is immediately called with an empty object
    let callExpPath = path.parentPath.parentPath;
    let callExpNode = path.parentPath.parentPath.node;
    if (!t.isCallExpression(callExpNode)) {
      throw path.parentPath.buildCodeFrameError(
        "A styled component's wrapping function must be called immediately"
      );
    }
    let args = callExpPath.get('arguments');
    const isEmptyObjOrAsExpression = (theArgs: NodePath[]) =>
      theArgs.length === 1 &&
      (t.isTSAsExpression(theArgs[0].node) ||
        (t.isObjectExpression(theArgs[0].node) &&
          theArgs[0].node.properties.length === 0));

    if (!Array.isArray(args)) {
      throw callExpPath.buildCodeFrameError(
        "A styled component's wrapping function must be called immediately"
      );
    }
    if (!isEmptyObjOrAsExpression(args)) {
      throw args[0].buildCodeFrameError(
        "A styled component's wrapping function expects an empty object literal"
      );
    }
    //
    if (param && param.node && param.node.name) {
      propsName = param.node.name;
    }
    // Save metadata for next visit.
    callExpPath.state = {};
    callExpPath.state.parentWasArrow = true;
    callExpPath.state.propsName = propsName;
    callExpPath.replaceWith(path.node);
    return;
  }

  let expressionValues: ExpressionValue[] = [];
  log('collecting expressions');
  const expressions = path.get('quasi').get('expressions');
  const quasis = path.get('quasi').get('quasis');
  // Evaluate CSS comment location and nesting depth
  let expMeta = calcExpressionStats(quasis, expressions);
  // Validate and transform all expressions
  expressions.forEach((ex, i) => {
    if (t.isStringLiteral(ex)) {
      return;
    } else if (t.isArrayExpression(ex) && styled) {
      // Validate
      let elements = ex.get('elements') as NodePath<any>[];
      if (elements.length !== 1) {
        throw ex.buildCodeFrameError(
          'Modifier expression array must contain only 1 element'
        );
      }

      let el1 = elements[0];
      if (!t.isExpression(el1.node)) {
        throw ex.buildCodeFrameError(
          'Expected modifier condition to be an expression'
        );
      }

      if (expMeta[i].nestLevel > 0 && !expMeta[i].inComment) {
        throw ex.buildCodeFrameError('Modifier expression must not be nested.');
      }

      if (!expMeta[i].valid && !expMeta[i].inComment) {
        throw ex.buildCodeFrameError(
          'Modifier expressions must target the root selector and may not be preceded by a dot.'
        );
      }

      if (
        !t.isFunctionExpression(el1.node) &&
        !t.isArrowFunctionExpression(el1.node)
      ) {
        if (parentWasArrow) {
          if (!el1 || !hasProp(el1, propsName)) {
            throw ex.buildCodeFrameError(
              `Expected modifier condition to access ${propsName}`
            );
          }
          makeArrow(el1, propsName);
        } else {
          throw el1.buildCodeFrameError(
            'You must wrap the styled tag in an arrow function or this condition must be a function.'
          );
        }
      }

      // Transform to arrow function if props are referenced
    } else if (t.isArrayExpression(ex) && !styled) {
      throw ex.buildCodeFrameError(
        'Modifier expressions can only be used with styled components'
      );
    } else if (
      parentWasArrow &&
      !t.isFunctionExpression(ex.node) &&
      !t.isArrowFunctionExpression(ex.node) &&
      hasProp(ex, propsName)
    ) {
      makeArrow(ex, propsName);
    }
  });

  expressionValues = expressions.map((ex: NodePath<t.Expression>, i) => {
    if (expMeta[i].inComment) {
      return { kind: ValueType.VALUE, value: expMeta[i].placeholder };
    }
    const result = ex.evaluate();
    if (result.confident) {
      throwIfInvalid(result.value, ex);
      return { kind: ValueType.VALUE, value: result.value };
    }

    if (
      options.evaluate &&
      !(
        t.isFunctionExpression(ex) ||
        t.isArrowFunctionExpression(ex) ||
        t.isArrayExpression(ex)
      )
    ) {
      return { kind: ValueType.LAZY, ex };
    }

    return { kind: ValueType.RUNTIME, ex };
  });

  // Increment the index of the style we're processing
  // This is used for slug generation to prevent collision
  // Also used for display name if it couldn't be determined
  state.index++;

  let [slug, displayName] = getLinariaComment(path);

  const parent = path.findParent(
    p =>
      t.isObjectProperty(p) ||
      t.isJSXOpeningElement(p) ||
      t.isVariableDeclarator(p)
  );

  if (!displayName && parent) {
    const parentNode = parent.node;
    if (t.isObjectProperty(parentNode)) {
      displayName = parentNode.key.name || parentNode.key.value;
    } else if (
      t.isJSXOpeningElement(parentNode) &&
      t.isJSXIdentifier(parentNode.name)
    ) {
      displayName = parentNode.name.name;
    } else if (
      t.isVariableDeclarator(parentNode) &&
      t.isIdentifier(parentNode.id)
    ) {
      displayName = parentNode.id.name;
    }
  }

  if (!displayName) {
    // Try to derive the path from the filename
    displayName = basename(state.file.opts.filename);

    if (/^index\.[a-z0-9]+$/.test(displayName)) {
      // If the file name is 'index', better to get name from parent folder
      displayName = basename(dirname(state.file.opts.filename));
    }

    // Remove the file extension
    displayName = displayName.replace(/\.[a-z0-9]+$/, '');

    if (displayName) {
      displayName += state.index;
    } else {
      throw path.buildCodeFrameError(
        "Couldn't determine a name for the component. Ensure that it's either:\n" +
          '- Assigned to a variable\n' +
          '- Is an object property\n' +
          '- Is a prop in a JSX element\n'
      );
    }
  }

  // Custom properties need to start with a letter, so we prefix the slug
  // Also use append the index of the class to the filename for uniqueness in the file
  slug =
    slug ||
    toValidCSSIdentifier(
      `${displayName.charAt(0).toLowerCase()}${slugify(
        `${relative(state.file.opts.root, state.file.opts.filename)}:${
          state.index
        }`
      )}`
    );

  // Save evaluated slug and displayName for future usage in templateProcessor
  path.addComment('leading', `linaria ${slug} ${displayName}`);
  if (options.evaluate && styled && 'name' in styled.component.node) {
    expressionValues.push({
      kind: ValueType.LAZY,
      ex: styled.component as NodePath<t.Expression>,
    });
  }

  // Add expression metadata to state
  if (!path.state) {
    path.state = {};
  }
  path.state.expMeta = expMeta;

  state.queue.push({
    styled,
    path,
    expressionValues,
    isGlobal,
  });
}
