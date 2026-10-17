import { describe, it, expect } from 'vitest';
import { klDate, klTime } from './dates';

describe('klDate', () => {
  it('maps 16:30 UTC to the next KL day', () => {
    expect(klDate(new Date('2026-10-17T16:30:00Z'))).toBe('2026-10-18');
  });
  it('keeps 15:59 UTC on the same KL day', () => {
    expect(klDate(new Date('2026-10-18T15:59:00Z'))).toBe('2026-10-18');
  });
});

describe('klTime', () => {
  it('formats the KL wall-clock time as HH:mm', () => {
    expect(klTime(new Date('2026-10-18T01:05:00Z'))).toBe('09:05');
    expect(klTime(new Date('2026-10-18T15:30:00Z'))).toBe('23:30');
  });
});
