import { describe, it, expect } from 'vitest';
import { parseAmountToSen, formatSen } from './money';

describe('parseAmountToSen', () => {
  it.each([
    ['50', 5000],
    ['50.5', 5050],
    ['RM 1,000.00', 100000],
    [' 20 ', 2000],
    ['rm20', 2000],
    ['100000', 10000000],
  ])('parses %s', (input, sen) => {
    expect(parseAmountToSen(input)).toEqual({ ok: true, sen });
  });
  it('rejects zero', () => expect(parseAmountToSen('0')).toEqual({ ok: false, error: 'zero' }));
  it.each(['-5', 'abc', '50.555', '', '1,00'])('rejects %s as invalid', (input) => {
    expect(parseAmountToSen(input)).toEqual({ ok: false, error: 'invalid' });
  });
  it('rejects over RM 100,000', () => {
    expect(parseAmountToSen('100000.01')).toEqual({ ok: false, error: 'tooLarge' });
  });
});

describe('formatSen', () => {
  it('formats with thousands separator', () => expect(formatSen(100000)).toBe('RM 1,000.00'));
  it('formats sen', () => expect(formatSen(5050)).toBe('RM 50.50'));
});
