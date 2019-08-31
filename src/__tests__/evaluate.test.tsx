import path from 'path';
import dedent from 'dedent';
import Module from '../babel/module';
import evaluate from '../babel/evaluate/evaluate';

const test = path.resolve(__dirname, './__fixtures__/test.js');

beforeEach(() => Module.invalidate());

it('evaluates exports', () => {
  const filename = '/foo/bar/test.js';
  const result = evaluate('module.exports = () => 42', filename);

  expect(result.value()).toBe(42);
});

it('evaluates imports', () => {
  const result = evaluate(
    dedent`
    import answer from './sample-script';

    export const result = 'The answer is ' + answer;
  `,
    test
  );

  expect(result.value.result).toBe('The answer is 42');
});
