/**
 * This is required for source-map-support only for testing linaria.
 * Jest doesn't like to share source-map-support which causes problems with stack trace lines, so we must patch it here.
 */

const fs = require('fs');

const jestRunTest = require.resolve('jest-runner/build/runTest.js');
let original = fs.readFileSync(jestRunTest).toString();
if (original.includes('requireInternalModule')) {
  let file = original.replace('requireInternalModule', 'requireModule');
  fs.writeFileSync(jestRunTest, file, 'utf8');
}
