import { describe, it, expect } from 'vitest';
import { settleWithin } from './settle';

describe('settleWithin', () => {
  it('reports done when the promise resolves in time', async () => {
    expect(await settleWithin(Promise.resolve(1), 50)).toBe('done');
  });
  it('reports pending when the promise is still waiting', async () => {
    expect(await settleWithin(new Promise(() => {}), 20)).toBe('pending');
  });
  it('rethrows a rejection that happens in time', async () => {
    await expect(settleWithin(Promise.reject(new Error('x')), 50)).rejects.toThrow('x');
  });
});
