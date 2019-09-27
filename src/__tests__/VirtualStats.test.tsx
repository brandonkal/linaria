import VirtualStats from '../utils/VirtualStats';

it('exposes stat methods', () => {
  jest.spyOn(Date, 'now').mockImplementation(() => 0);
  const s = new VirtualStats({ size: 10 });
  expect(s.isDirectory()).toBe(false);
  expect(s.isBlockDevice()).toBe(false);
  expect(s.isSymbolicLink()).toBe(false);
  expect(s.isCharacterDevice()).toBe(false);
  expect(s.isSocket()).toBe(false);
  expect(s.isFIFO()).toBe(false);
  expect(s.size).toBe(10);
  expect(s.mtimeMs).toBe(0);
});
