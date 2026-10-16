import { describe, it, expect } from 'vitest';
import { normalizeMyPhone } from './phone';

describe('normalizeMyPhone', () => {
  it.each(['012-345 6789', '0123456789', '+60 12-345 6789', '60123456789'])('normalizes %s', (input) => {
    expect(normalizeMyPhone(input)).toEqual({ ok: true, e164: '+60123456789' });
  });
  it('accepts 011 numbers with 8 digits after the prefix', () => {
    expect(normalizeMyPhone('011-1234 5678')).toEqual({ ok: true, e164: '+601112345678' });
  });
  it.each(['12345', '+6591234567', '', '03-1234 5678', 'abc'])('rejects %s', (input) => {
    expect(normalizeMyPhone(input)).toEqual({ ok: false, error: 'invalid' });
  });
});
