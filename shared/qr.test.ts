import { describe, it, expect } from 'vitest';
import { personalQrPayload, parsePersonalQr } from './qr';

describe('personal QR', () => {
  it('round-trips a person id', () => {
    expect(parsePersonalQr(personalQrPayload('abc123'))).toBe('abc123');
  });
  it('rejects foreign content', () => {
    expect(parsePersonalQr('https://evil.com')).toBeNull();
  });
  it('rejects empty id', () => {
    expect(parsePersonalQr('cqr:p:')).toBeNull();
  });
  it('rejects ids with path characters', () => {
    expect(parsePersonalQr('cqr:p:a/b')).toBeNull();
  });
});
