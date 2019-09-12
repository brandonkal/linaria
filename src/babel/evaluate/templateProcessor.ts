/* eslint-disable no-param-reassign */
import { types as t } from '@babel/core';
import { NodePath } from '@babel/traverse';
import generator from '@babel/generator';
import generateModifierName from '../utils/generateModifierName';
import { ExpressionMeta } from '../utils/calcExpressionStats';

import { units } from '../units';
import {
  State,
  StrictOptions,
  TemplateExpression,
  ValueStrings,
  Interpolation,
} from '../types';

import throwIfInvalid from '../utils/throwIfInvalid';
import stripLines from '../utils/stripLines';
import toValidCSSIdentifier from '../utils/toValidCSSIdentifier';
import toCSS from '../utils/toCSS';
import getLinariaComment from '../utils/getLinariaComment';

// Match any valid CSS units followed by a separator such as ;, newline etc.
const unitRegex = new RegExp(`^(${units.join('|')})(;|,|\n| |\\))`);

type Modifier = {
  id: string;
  node: t.Expression;
  source: string;
  inComment: boolean;
};

export default function getTemplateProcessor(options: StrictOptions) {
  const wrapId = (id: string) =>
    options.optimize ? `LINARIA_${id}_LINARIA` : id;

  return function processTemplate(
    { styled, path, isGlobal }: TemplateExpression,
    state: State,
    valueStrings: ValueStrings
  ) {
    const { quasi } = path.node;

    const interpolations: Interpolation[] = [];
    const modifiers: Modifier[] = [];

    // Check if the variable is referenced anywhere for basic DCE
    // Only works when it's assigned to a variable
    let isReferenced = true;

    const [slug, displayName] = getLinariaComment(path);

    const parent = path.findParent(
      p =>
        t.isObjectProperty(p) ||
        t.isJSXOpeningElement(p) ||
        t.isVariableDeclarator(p)
    );

    if (parent) {
      const parentNode = parent.node;
      if (t.isVariableDeclarator(parentNode) && t.isIdentifier(parentNode.id)) {
        const { referencePaths } = path.scope.getBinding(
          parentNode.id.name
        ) || { referencePaths: [] };

        isReferenced = referencePaths.length !== 0;
      }
    }

    if (!isReferenced && !isGlobal) {
      // Bundler DCE will remove this assignment.
      path.replaceInline(t.stringLiteral('LinariaDeadCSS'));
      return;
    }

    const cls =
      options.displayName && !options.optimize
        ? `${toValidCSSIdentifier(displayName!)}_${slug}`
        : slug;

    const className = isGlobal ? `global_${cls}` : wrapId(cls!);
    // We only need a short id for classNames that end in the CSS file.
    let prevalStrings: string[] = [];
    let selectorWrap: string | undefined;

    // Serialize the tagged template literal to a string
    let cssText = '';

    const expressions = path.get('quasi').get('expressions');
    const expMeta: ExpressionMeta[] =
      path.state && path.state.expMeta ? path.state.expMeta : [];

    quasi.quasis.forEach((el, i, self) => {
      if (!options._isEvaluatePass) {
        let appended = false;
        if (i !== 0 && el.value && el.value.cooked) {
          // Check if previous expression was a CSS variable that we replaced
          // If it has a unit after it, we need to move the unit into the interpolation
          // e.g. `var(--size)px` should actually be `var(--size)`
          // So we check if the current text starts with a unit, and add the unit to the previous interpolation
          // Another approach would be `calc(var(--size) * 1px), but some browsers don't support all units
          // https://bugzilla.mozilla.org/show_bug.cgi?id=956573
          const matches = el.value.cooked.match(unitRegex);

          if (matches) {
            const last = interpolations[interpolations.length - 1];
            const [, unit] = matches;

            if (last && cssText.endsWith(`var(--${last.id})`)) {
              last.unit = unit;
              cssText += el.value.cooked.replace(unitRegex, '$2');
              appended = true;
            }
          }
        }

        if (!appended) {
          cssText += el.value.cooked;
        }
      }

      const ex = expressions[i];

      if (ex) {
        const getLoc = (): t.SourceLocation => {
          const { end } = ex.node.loc!;
          // The location will be end of the current string to start of next string
          const next = self[i + 1];
          return {
            // +1 because the expressions location always shows 1 column before
            start: { line: el.loc!.end.line, column: el.loc!.end.column + 1 },
            end: next
              ? { line: next.loc!.start.line, column: next.loc!.start.column }
              : { line: end.line, column: end.column + 1 },
          };
        };
        // Test if ex is inline array expression. This has already been validated.
        if (t.isArrayExpression(ex)) {
          if (options._isEvaluatePass) {
            // No need to evaluate modifiers here.
            return;
          }
          if (styled) {
            // Validate
            // Track if prop should pass through
            let elements = ex.get('elements') as NodePath<any>[];

            // Generate BEM name from source
            let modEl = elements[0] as NodePath<t.FunctionExpression>;
            let param = modEl.node.params[0];
            let paramText = 'props';
            if ('name' in param) {
              paramText = param.name;
            }
            const body = modEl.get('body');
            let returns: string[] = [];
            const returnVisitor = {
              ReturnStatement(path: NodePath<t.ReturnStatement>) {
                let arg = path.get('argument');
                if (arg) {
                  const src =
                    arg.getSource() ||
                    (arg.node && generator(arg.node).code) ||
                    'unknown';
                  returns.push(src);
                }
              },
            };
            body.traverse(returnVisitor);
            // If no explicit return statement is found, it is likely an arrow return.
            let bodyText =
              returns[0] === undefined ||
              returns[0] === null ||
              returns[0] === 'unknown'
                ? body.getSource() ||
                  (body.node && generator(body.node).code) ||
                  'unknown'
                : returns[0];
            const modName = generateModifierName(paramText, bodyText);
            // Push modifier to array -- NOTE: changing format requires updating optimizer
            const id = `${wrapId(slug!)}${
              options.optimize ? '-' : `__${modName}_`
            }${i}`;

            modifiers.push({
              id,
              node: modEl.node,
              source: generator(modEl.node).code,
              inComment: expMeta[i].inComment,
            });

            cssText += `.${id}`;
          } else {
            // CSS modifiers can't be used outside components
            throw ex.buildCodeFrameError(
              "The CSS cannot contain modifier expressions outside of the 'styled' tag."
            );
          }
        } else {
          // Evaluate normal interpolation
          const result = ex.evaluate();
          const beforeLength = cssText.length;
          const loc = getLoc();

          if (result.confident) {
            throwIfInvalid(result.value, ex);

            cssText += stripLines(loc, toCSS(result.value));

            state.replacements.push({
              original: loc,
              length: cssText.length - beforeLength,
            });
          } else {
            // Try to fetch preval-ed value. If preval, return early to process the next expression.
            if (
              options.evaluate &&
              !(
                t.isFunctionExpression(ex) ||
                t.isArrowFunctionExpression(ex) ||
                // Identifiers are evaluated as if they were interpolations. They may reference a function.
                // The interpolation will be removed if in the evaluate pass.
                (styled && t.isIdentifier(ex))
              )
            ) {
              const placholder = valueStrings.get(ex);
              throwIfInvalid(placholder, ex);

              if (placholder) {
                prevalStrings.push(placholder);
                cssText += stripLines(loc, toCSS(placholder));

                state.replacements.push({
                  original: loc,
                  length: cssText.length - beforeLength,
                });
                return;
              }
            } else if (t.isObjectExpression(ex)) {
              throw ex.buildCodeFrameError(
                'Unexpected object expression.\n' +
                  "To evaluate the expressions at build time, pass 'evaluate: true' to the babel plugin."
              );
            } else if (styled) {
              const idPrefix = `${wrapId(slug!)}-`;
              const prevalKey = valueStrings.get(ex);

              interpolations.push({
                get id() {
                  return this.idPrefix + this.index;
                },
                idPrefix,
                index: i,
                node: ex.node,
                source: ex.getSource() || generator(ex.node).code,
                unit: '',
                inComment: expMeta[i].inComment,
                isLazy: t.isIdentifier(ex),
                prevalKey,
              });

              cssText += `var(--${idPrefix}${i})`;
            } else {
              // CSS custom properties can't be used outside components
              throw ex.buildCodeFrameError(
                "The CSS cannot contain JavaScript expressions when using the 'css' or 'injectGlobal' tag.\n" +
                  "To evaluate the expressions at build time, pass 'evaluate: true' to the babel plugin."
              );
            }
          }
        }
      }
    });

    // props object for styled call. We set it here so it can be modified in buildCSS.
    const props: t.ObjectProperty[] = [];

    if (styled) {
      // If `styled` wraps another component and not a primitive,
      // we should create a more specific selector
      // here we set selectorWrap to the nodePath to evaluate this lazily
      if (options.evaluate && t.isIdentifier(styled.component.node)) {
        // prettier-ignore
        selectorWrap = valueStrings.get(styled.component as NodePath<t.Expression>);
      }

      props.push(
        t.objectProperty(t.identifier('name'), t.stringLiteral(displayName!))
      );

      props.push(
        t.objectProperty(t.identifier('class'), t.stringLiteral(className))
      );

      // If we found any interpolations, they will be processed in the buildCSS stage.

      // If any modifiers were found, also pass them so they can be applied.
      // The length will be zero if options._isEvaluatePass
      // Note that these can still exist in the compiled code for preval depending on the order of discovery.
      // This is not an issue because modifiers and interpolations will not be evaluated.
      if (modifiers.length) {
        // De-duplicate modifiers based on the source
        // If two modifiers have the same source code,
        // we don't need to use 2 classNames for them, we can use a single one.
        const result: { [key: string]: Modifier } = {};
        modifiers.forEach(mod => {
          const key = mod.source;
          if (key in result) {
            cssText = cssText.replace(mod.id, result[key].id);
          } else if (!mod.inComment) {
            result[key] = mod;
          }
        });

        let keys = Object.keys(result);
        if (keys.length > 0) {
          // Save to compiled JS object
          props.push(
            t.objectProperty(
              t.identifier('mod'),
              t.objectExpression(
                keys.map(key => {
                  const { id, node } = result[key];
                  return t.objectProperty(t.stringLiteral(id), node);
                })
              )
            )
          );
        }
      }

      path.replaceWith(
        t.callExpression(
          t.callExpression(t.identifier('styled'), [styled.component.node]),
          [t.objectExpression(props)]
        )
      );

      path.addComment('leading', '#__PURE__');
    } else if (isGlobal) {
      path.remove();
    } else {
      path.replaceWith(t.stringLiteral(className));
    }

    state.rules[className] = {
      cssText,
      className,
      selectorWrap,
      displayName: displayName!,
      start: path.parent && path.parent.loc ? path.parent.loc.start : undefined,
      isGlobal,
      // We save these to the rule state to evaluate lazily
      props,
      interpolations,
      prevalStrings,
    };
  };
}
