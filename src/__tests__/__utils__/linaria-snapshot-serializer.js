module.exports = {
  test: value => value && typeof value.linaria === 'object',
  print: ({ linaria }) => `
CSS:

${linaria.cssText.replace(/^\n\n/gm, '').replace(/^\n/, '')}

Dependencies: ${
    linaria.dependencies.length ? linaria.dependencies.join(', ') : 'NA'
  }
`,
};
