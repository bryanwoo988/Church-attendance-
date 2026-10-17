import { describe, it, expect } from 'vitest';
import { parsePosterUrl } from './poster';

const ORIGINS = ['https://church.web.app', 'https://church.firebaseapp.com'];

describe('parsePosterUrl', () => {
  it('maps the general check-in poster to /checkin', () => {
    expect(parsePosterUrl('https://church.web.app/checkin', ORIGINS)).toBe('/checkin');
  });
  it('keeps the meeting id of a group/event poster', () => {
    expect(parsePosterUrl('https://church.firebaseapp.com/checkin?m=g%201&x=1', ORIGINS)).toBe('/checkin?m=g%201');
  });
  it('maps the newcomer poster to /welcome', () => {
    expect(parsePosterUrl('https://church.web.app/welcome', ORIGINS)).toBe('/welcome');
  });
  it('rejects other sites, other paths, personal QR codes and junk', () => {
    expect(parsePosterUrl('https://evil.example/checkin', ORIGINS)).toBeNull();
    expect(parsePosterUrl('https://church.web.app/admin/people', ORIGINS)).toBeNull();
    expect(parsePosterUrl('cqr:p:abc', ORIGINS)).toBeNull();
    expect(parsePosterUrl('hello', ORIGINS)).toBeNull();
  });
});
