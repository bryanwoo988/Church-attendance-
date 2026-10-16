import { describe, it, expect } from 'vitest';
import { sundayMeetingFor } from './sunday';
import { DEFAULT_SETTINGS } from './types';

const settings = { ...DEFAULT_SETTINGS, sunday: { weekday: 0, start: '09:00', end: '11:30', checkinMode: 'window' as const } };

describe('sundayMeetingFor', () => {
  it('on Saturday returns next day with KL window', () => {
    const m = sundayMeetingFor(settings, new Date('2026-10-17T00:05:00+08:00'));
    expect(m.id).toBe('sunday-2026-10-18');
    expect(m.date).toBe('2026-10-18');
    expect(m.windowStart?.toISOString()).toBe('2026-10-18T01:00:00.000Z');
    expect(m.windowEnd?.toISOString()).toBe('2026-10-18T03:30:00.000Z');
  });
  it('on Sunday returns the same day', () => {
    expect(sundayMeetingFor(settings, new Date('2026-10-18T08:00:00+08:00')).date).toBe('2026-10-18');
  });
  it('on Monday returns the following Sunday', () => {
    expect(sundayMeetingFor(settings, new Date('2026-10-19T08:00:00+08:00')).date).toBe('2026-10-25');
  });
  it('always mode has no window', () => {
    const m = sundayMeetingFor({ ...settings, sunday: { ...settings.sunday, checkinMode: 'always' } }, new Date('2026-10-17T00:05:00+08:00'));
    expect(m.checkinMode).toBe('always');
    expect(m.windowStart).toBeUndefined();
  });
});
