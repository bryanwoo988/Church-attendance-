import { describe, it, expect } from 'vitest';
import { personalQrPayload, parsePersonalQr } from './qr';

const O = 'https://church.web.app';

describe('personal QR', () => {
  it('encodes a link to the app', () => {
    expect(personalQrPayload('abc123', O)).toBe('https://church.web.app/p/abc123');
  });
  it('round-trips a person id', () => {
    expect(parsePersonalQr(personalQrPayload('abc123', O), [O])).toBe('abc123');
  });
  it('still reads the older code form', () => {
    expect(parsePersonalQr('cqr:p:abc123', [O])).toBe('abc123');
  });
  it('rejects links from other sites', () => {
    expect(parsePersonalQr('https://evil.com/p/abc123', [O])).toBeNull();
    expect(parsePersonalQr('https://evil.com', [O])).toBeNull();
  });
  it('rejects other paths on our site', () => {
    expect(parsePersonalQr(`${O}/checkin`, [O])).toBeNull();
    expect(parsePersonalQr(`${O}/p/a/b`, [O])).toBeNull();
    expect(parsePersonalQr(`${O}/p/abc?x=1`, [O])).toBeNull();
  });
  it('rejects empty id', () => {
    expect(parsePersonalQr('cqr:p:', [O])).toBeNull();
    expect(parsePersonalQr(`${O}/p/`, [O])).toBeNull();
  });
  it('rejects ids with path characters', () => {
    expect(parsePersonalQr('cqr:p:a/b', [O])).toBeNull();
  });
});
