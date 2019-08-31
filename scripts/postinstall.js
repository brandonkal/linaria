const { readFileSync, writeFileSync } = require('fs');
const filePath = require.resolve('source-map-support');
const original = readFileSync(filePath, 'utf-8');
writeFileSync(
  filePath,
  original.replace(
    'var retrieveMapHandlers = [];\n',
    'var retrieveMapHandlers = []; if (global) global.retrieveMapHandlers = retrieveMapHandlers;'
  ),
  'utf-8'
);
