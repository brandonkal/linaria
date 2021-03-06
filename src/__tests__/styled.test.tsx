/* eslint-disable no-console */
import React from 'react';
import renderer from 'react-test-renderer';
const styled = require('../react/styled').default;

it('renders tag with display name and class name', () => {
  const Test = styled('h1')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  expect(Test.displayName).toBe('TestComponent');
  expect(Test.__linaria.className).toBe('abcdefg');
  expect(Test.__linaria.extends).toBe('h1');

  const tree = renderer.create(<Test>This is a test</Test>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('renders component with display name and class name', () => {
  const Custom = props => <div {...props} />;

  const Test = styled(Custom)({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  expect(Test.displayName).toBe('TestComponent');
  expect(Test.__linaria.className).toBe('abcdefg');
  expect(Test.__linaria.extends).toBe(Custom);

  const tree = renderer.create(<Test>This is a test</Test>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('applies CSS variables in style prop', () => {
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
    vars: {
      foo: ['tomato'],
      bar: [20, 'px'],
      baz: [props => props.size, 'px'],
    },
  });

  const tree = renderer.create(<Test size={24}>This is a test</Test>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('applies CSS modifiers in style prop', () => {
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
    mod: {
      large: props => props.size$ > 20,
    },
  });

  const tree = renderer.create(<Test size$={24}>This is a test</Test>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('merges CSS variables with custom style prop', () => {
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
    vars: {
      foo: ['tomato'],
    },
  });

  const tree = renderer.create(
    <Test style={{ bar: 'baz' }}>This is a test</Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('supports extra className prop', () => {
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(<Test className="primary">This is a test</Test>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('supports extra class prop', () => {
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(<Test class="primary">This is a test</Test>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('replaces simple component with as prop', () => {
  const Test = styled('button')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(
    <Test as="a" id="test" foo$="bar">
      This is a test
    </Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('replaces custom component with as prop for primitive', () => {
  const Custom = props => <div {...props} style={{ fontSize: 12 }} />;

  const Test = styled(Custom)({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(
    <Test as="a" id="test" foo$="bar">
      This is a test
    </Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('replaces primitive with as prop for custom component', () => {
  const Custom = props => <div {...props} style={{ fontSize: 12 }} />;

  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(
    <Test as={Custom} id="test" foo="bar">
      This is a test
    </Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('handles wrapping another styled component', () => {
  const First = styled('div')({
    name: 'FirstComponent',
    class: 'abcdefg',
  });

  const Second = styled(First)({
    name: 'SecondComponent',
    class: 'hijklmn',
  });

  const tree = renderer.create(<Second>This is a test</Second>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('forwards as prop when wrapping another styled component', () => {
  const First = styled('div')({
    name: 'FirstComponent',
    class: 'abcdefg',
  });

  const Second = styled(First)({
    name: 'SecondComponent',
    class: 'hijklmn',
  });

  const tree = renderer.create(<Second as="a">This is a test</Second>);

  expect(tree.toJSON()).toMatchSnapshot();
});

it('filters $ suffix attributes for HTML tag', () => {
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(
    <Test unknownAttribute$="voila">This is a test</Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('filters attributes for custom elements', () => {
  const Test = styled('my-element')({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(
    <Test unknownAttribute$="voila">This is a test</Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('does not filter attributes for components', () => {
  const Custom = props => <div>{props.unknownAttribute}</div>;

  const Test = styled(Custom)({
    name: 'TestComponent',
    class: 'abcdefg',
  });

  const tree = renderer.create(
    <Test unknownAttribute="voila">This is a test</Test>
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('throws when using as tag for template literal', () => {
  expect(
    () =>
      styled('div')`
        color: blue;
      `
  ).toThrow('Using the "styled" tag in runtime is not supported');

  expect(
    () =>
      styled.div`
        color: blue;
      `
  ).toThrow('Using the "styled" tag in runtime is not supported');
});

it('warns if interpolation does not evaluate to a string or number', () => {
  const spy = jest.spyOn(console, 'warn').mockImplementation();
  const Test = styled('div')({
    name: 'TestComponent',
    class: 'abcdefg',
    vars: {
      a: [
        () => {
          return {
            color: 'red',
          };
        },
      ],
    },
  });

  renderer.create(<Test>This is a test</Test>);

  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});
