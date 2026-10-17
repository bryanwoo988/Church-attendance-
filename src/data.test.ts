import { describe, it, expect } from 'vitest';
import { errorKey } from './data';

describe('errorKey', () => {
  it('reads our message key from a callable error', () => {
    expect(errorKey({ code: 'functions/invalid-argument', message: 'login.invalidPhone' })).toBe('login.invalidPhone');
  });
  it('ignores the HTTP status the Firebase SDK appends', () => {
    expect(errorKey({ code: 'functions/invalid-argument', message: 'login.invalidPhone [400]' })).toBe('login.invalidPhone');
    expect(errorKey({ code: 'functions/failed-precondition', message: 'checkin.closed [400]' })).toBe('checkin.closed');
  });
  it('returns null for other messages', () => {
    expect(errorKey({ message: 'INTERNAL [500]' })).toBeNull();
    expect(errorKey(new Error('network down'))).toBeNull();
    expect(errorKey(undefined)).toBeNull();
  });
});
