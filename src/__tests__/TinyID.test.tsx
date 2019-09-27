import TinyID from '../utils/tinyId';

it('generates tiny ids', () => {
  const prefix = 'test';
  const tiny = new TinyID({ optimize: true, prefix: 'test' });
  const arr = [];
  arr.push(tiny.get('one'));
  arr.push(tiny.get('two'));
  arr.push(tiny.get('one'));
  const expected = ['a', 'b', 'a'];
  expected.forEach((str, idx) => {
    expect(arr[idx]).toBe(prefix + str);
  });
});

it('returns input if optimize false', () => {
  const tiny = new TinyID({ optimize: false, prefix: '' });
  expect(tiny.get('input')).toBe('input');
});

it('returns existing records and resets', () => {
  const tiny = new TinyID({ optimize: true, prefix: '' });
  const existing = {
    one: 'first',
    two: 'second',
    four: 'fourth',
  };
  tiny.record = existing;
  let arr = [];
  arr.push(tiny.get('one'));
  arr.push(tiny.get('two'));
  arr.push(tiny.get('three'));
  arr.push(tiny.get('four'));
  checkExpected(arr, ['first', 'second', 'a', 'fourth']);
  tiny.reset();
  arr = [];
  arr.push(tiny.get('one'));
  arr.push(tiny.get('two'));
  arr.push(tiny.get('three'));
  arr.push(tiny.get('four'));
  arr.push(tiny.get('one'));
  checkExpected(arr, ['a', 'b', 'c', 'd', 'a']);
});

function checkExpected(arr: any[], expected: any[]) {
  expected.forEach((str, idx) => {
    expect(arr[idx]).toBe(str);
  });
}
