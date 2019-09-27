import VirtualStats from '../utils/VirtualStats';

it('exposes stat methods', () => {
  jest.spyOn(Date, 'now').mockImplementationOnce(() => 0);
  const s = new VirtualStats({ size: 100 });
  expect(s.isFile()).toBe(true);
  expect(s.isFIFO()).toBe(false);
  expect(s.isSocket()).toBe(false);
  expect(s.isDirectory()).toBe(false);
  expect(s.isBlockDevice()).toBe(false);
  expect(s.isSymbolicLink()).toBe(false);
  expect(s.isCharacterDevice()).toBe(false);
  expect(s.size).toBe(100);
  expect(s.mtimeMs).toBe(0);
});
