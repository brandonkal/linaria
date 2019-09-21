import buildCSS from '../../utils/buildCSS';
export default {
  test: value => value && typeof value.linaria === 'object',
  print: ({ linaria, keepEmptyLines }) => `
CSS:

${
  keepEmptyLines
    ? buildCSS(linaria.rules, linaria.replacer)
    : buildCSS(linaria.rules, linaria.replacer)
        .replace(/^\n\n/gm, '')
        .replace(/^\n/, '')
}

Dependencies: ${
    linaria.dependencies.length
      ? linaria.dependencies
          .map(dep => dep.replace(process.cwd(), '<<DIRNAME>>'))
          .join(', ')
      : 'NA'
  }
`,
};
