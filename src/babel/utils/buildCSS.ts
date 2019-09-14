import { Rules, Interpolation } from '../types';
import { types as t } from '@babel/core';

/**
 * Constructs a CSS text for a set of rules and attaches interpolations object to the styled call.
 * This allows us to evaluate identifiers during the build.
 * If the identifier references a function, it will be handled as a runtime interpolation.
 * buildCSS accepts a replacer function that maps a placeholder to an evaluated string.
 */
export default function buildCSS(
  rules: Rules,
  replacer: (key: string, allowFn?: boolean, wrapCls?: string) => string,
  optsEvaluate: boolean
) {
  let cssText = '';
  if (!rules) {
    return cssText;
  }
  Object.values(rules).forEach(rule => {
    // Append new lines until we get to the start line number
    let line = cssText.split('\n').length;
    while (rule.start && line < rule.start.line) {
      cssText += '\n';
      line++;
    }
    if (!rule.isGlobal) {
      let selector = `.${rule.className}`;
      if (rule.selectorWrap) {
        // note: only possible when options.evaluate == true
        selector = replacer(rule.selectorWrap, true, selector);
      }
      cssText += `${selector} {`;
    }
    // Append blank spaces until we get to the start column number
    const last = cssText.split('\n').pop();
    let column = last ? last.length : 0;
    while (rule.start && column < rule.start.column) {
      cssText += ' ';
      column++;
    }
    // Handle preval replacement
    let inside = rule.cssText;
    rule.prevalStrings.forEach(placeholder => {
      inside = inside.replace(placeholder, replacer(placeholder));
    });
    // Evaluate interpolations that may contain preval-ed values
    if (optsEvaluate) {
      rule.interpolations
        .filter(it => it.isLazy)
        .forEach(it => {
          const cssVar = `var(--${it.id})`;
          const replacement = replacer(it.prevalKey!, true);
          if (replacement === it.prevalKey) {
            // This could not be preval-ed and is a runtime interpolation.
          } else {
            inside = inside.replace(cssVar, `${replacement}${it.unit}`);
            it.shouldSkip = true;
          }
        });
    }
    // Filter interpolations and attach to CSS
    inside = attachInterpolations(
      rule.interpolations.filter(it => !it.shouldSkip),
      inside,
      rule.props
    );
    cssText += inside;
    if (!rule.isGlobal) {
      cssText += '}';
    }
  });
  return cssText;
}

/**
 * For a given set of interpolations, attachInterpolations will:
 * 1. Modify the CSS text to deduplicate custom property names.
 * 2. Push the generated vars object property to the provided props array.
 */
export function attachInterpolations(
  interpolations: Interpolation[],
  cssText: string,
  props: t.ObjectProperty[]
) {
  // De-duplicate interpolations based on the source and unit
  // If two interpolations have the same source code and same unit,
  // we don't need to use 2 custom properties for them, we can use a single one
  const result: { [key: string]: Interpolation } = {};
  interpolations.forEach(it => {
    const key = it.source + it.unit;
    if (key in result) {
      cssText = cssText.replace(`var(--${it.id})`, `var(--${result[key].id})`);
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
    cssText = cssText.replace(`var(--${oldId})`, `var(--${it.id})`);
  });
  if (keys.length > 0) {
    // Save to compiled JS object
    props.push(
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
  return cssText;
}
