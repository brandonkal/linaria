import { context, createSandbox } from '../babel/sandbox';

it('process is restricted', () => {
  const ctx = context() as any;
  ctx.global.something = 10;
  expect(ctx.global.something).toBe(10);
  expect(() => (ctx.process.bad = 10)).toThrow();
  expect(ctx.process.bad).toBe(undefined);
});
it('shared globals cannot be modified', () => {
  let ctx = context() as any;
  expect(ctx.process.env.NODE_ENV).toBe('test');
  expect(() => {
    ctx.process.env.NODE_ENV = 'not-test';
  }).toThrow('Cannot assign to read only property');
  expect(ctx.process.env.NODE_ENV).toBe('test');
});

it('resets environment', () => {
  let ctx = context() as any;
  ctx.global.something = 10;
  expect(ctx.global.something).toBe(10);
  ctx = context();
  expect(ctx.global.something).toBe(undefined);
  ctx.window.secret = 'code-word';
  expect(ctx.window.secret).toBe('code-word');
  ctx = context();
  expect(ctx.window.secret).toBe(undefined);
});

it('includes process', () => {
  let ctx = context();
  expect(ctx.process.cwd()).toBe('/');
  expect(ctx.process.exit()).toBe(undefined);
  expect(typeof ctx.process.nextTick).toBe('function');
  ctx.process.nextTick(ctx.process.exit);
  expect(ctx.process.binding).toThrow();
});

it('generates a new sandbox', () => {
  expect(createSandbox()).not.toBe(createSandbox());
});
