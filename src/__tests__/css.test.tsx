import { css } from '..';

it('throws when using as tag for template literal', () => {
  expect(
    () =>
      css`
        color: blue;
      `
  ).toThrow(
    'Using the "css" or "injectGlobal" tag in runtime is not supported. Have you set up the Babel plugin correctly?'
  );
});
