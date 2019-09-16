module.exports = {
  test: value => value && typeof value.linaria === 'object',
  print: ({ linaria, keepEmptyLines }) => `
CSS:

${
  keepEmptyLines
    ? linaria.cssText
    : linaria.cssText.replace(/^\n\n/gm, '').replace(/^\n/, '')
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
