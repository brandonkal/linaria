import path from 'path';
import { SourceMapGenerator } from 'source-map';
import { Replacer, RuleBase } from '../babel/types';

/**
 * buildCSS accepts a replacer function that maps a placeholder to an evaluated string.
 */
export default function buildCSS(rules: RuleBase[], replacer: Replacer) {
  let cssText = '';

  rules.forEach(rule => {
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
    rule.prevalStrings.forEach(placeholder => {
      rule.cssText = rule.cssText.replace(placeholder, replacer(placeholder));
    });
    cssText += rule.cssText;
    if (!rule.isGlobal) {
      cssText += '}';
    }
  });
  return cssText;
}

export function buildCssSourceMap(
  jsPath: string,
  cssPath: string,
  code: string
) {
  const generator = new SourceMapGenerator({
    file: cssPath,
  });
  generator.addMapping({
    generated: {
      line: 1,
      column: 0,
    },
    original: {
      line: 1,
      column: 0,
    },
    source: jsPath,
  });
  generator.setSourceContent(jsPath, code);
  return generator.toJSON();
}
export function adjustRelativePaths(
  cssText: string,
  jsPath: string,
  cssPath?: string
) {
  if (cssPath) {
    cssText = cssText.replace(
      /\b(url\()(\.[^)]+)(\))/g,
      (_, p1, p2, p3) =>
        p1 +
        // Replace asset path with new path relative to the output CSS
        path.relative(
          path.dirname(cssPath),
          // Get the absolute path to the asset from the path relative to the JS file
          path.resolve(path.dirname(jsPath), p2)
        ) +
        p3
    );
  }
  return cssText;
}
