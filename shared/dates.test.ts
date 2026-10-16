import { describe, it, expect } from 'vitest';
import { klDate } from './dates';

describe('klDate', () => {
  it('maps 16:30 UTC to the next KL day', () => {
    expect(klDate(new Date('2026-10-17T16:30:00Z'))).toBe('2026-10-18');
  });
  it('keeps 15:59 UTC on the same KL day', () => {
    expect(klDate(new Date('2026-10-18T15:59:00Z'))).toBe('2026-10-18');
  });
});
