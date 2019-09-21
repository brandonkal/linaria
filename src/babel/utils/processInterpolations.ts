import { Rule, Interpolation, Replacer } from '../types';
import { types as t } from '@babel/core';
/**
 * Evaluates rules for interpolations that may contain preval-ed values.
 * Updates all rule.cssText properties and attaches interpolations object to the styled call.
 * This allows us to evaluate identifiers during the build.
 * If the identifier references a function, it will be handled as a runtime interpolation.
 * This is done during JavasScript evaluation.
 * The result is cssText where build-time evaluations must still be replaced by calling `buildCSS`.
 * This allows us to update CSS files independently.
 */
export function processInterpolations(
  rules: Rule[],
  replacer: Replacer,
  optsEvaluate: boolean
) {
  function processRule(rule: Rule) {
    if (optsEvaluate) {
      rule.interpolations
        .filter(it => it.isLazy)
        .forEach(it => {
          const cssVar = `var(--${it.id})`;
          const replacement = replacer(it.prevalKey!, true);
          if (replacement === it.prevalKey) {
            // This could not be preval-ed and is a runtime interpolation.
            it.shouldSkip = false;
          } else {
            rule.cssText = rule.cssText.replace(
              cssVar,
              `${replacement}${it.unit}`
            );
            it.shouldSkip = true;
          }
        });
    }
    // Filter interpolations and attach to CSS
    attachInterpolations(rule);
  }
  rules.forEach(processRule);
}
/**
 * For a given set of interpolations, attachInterpolations will:
 * 1. Modify the CSS text to deduplicate custom property names.
 * 2. Push the generated vars object property to the provided props array.
 */
export function attachInterpolations(rule: Rule) {
  // De-duplicate interpolations based on the source and unit
  // If two interpolations have the same source code and same unit,
  // we don't need to use 2 custom properties for them, we can use a single one
  const result: {
    [key: string]: Interpolation;
  } = {};
  rule.interpolations
    .filter(it => !it.shouldSkip)
    .forEach(it => {
      const key = it.source + it.unit;
      if (key in result) {
        rule.cssText = rule.cssText.replace(
          `var(--${it.id})`,
          `var(--${result[key].id})`
        );
      } else if (!it.inComment) {
        result[key] = it;
      }
    });
  const keys = Object.keys(result);
  // Minimize interpolation number for improved gzip.
  keys.forEach((key, i) => {
    const it = result[key];
    if (i === it.index) return;
    const oldId = it.id;
    it.index = i;
    rule.cssText = rule.cssText.replace(`var(--${oldId})`, `var(--${it.id})`);
  });
  if (keys.length > 0) {
    // Save to compiled JS object
    rule.props.push(
      t.objectProperty(
        t.identifier('vars'),
        t.objectExpression(
          keys.map(key => {
            const { id, node, unit } = result[key];
            const items = [node];
            if (unit) {
              items.push(t.stringLiteral(unit));
            }
            return t.objectProperty(
              t.stringLiteral(id),
              t.arrayExpression(items)
            );
          })
        )
      )
    );
  }
}
