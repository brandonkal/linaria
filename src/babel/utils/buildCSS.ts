import { Rules } from '../types';

export default function buildCSS(
  rules: Rules,
  replacer: (key: string, wrapCls?: string) => string
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
        selector = replacer(rule.selectorWrap, selector);
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
    cssText += inside;
    if (!rule.isGlobal) {
      cssText += '}';
    }
  });
  return cssText;
}
