import { describe, it, expect } from 'vitest';
import { isCheckinOpen, resolveCurrentMeeting, attendanceId } from './checkin';
import type { Meeting } from './types';

const always: Meeting = { id: 'sunday-2026-10-18', type: 'sunday', title: '主日', date: '2026-10-18', checkinMode: 'always' };
const win: Meeting = {
  id: 'g1', type: 'group', title: '小组', date: '2026-10-18', checkinMode: 'window',
  windowStart: new Date('2026-10-18T11:00:00Z'), windowEnd: new Date('2026-10-18T13:00:00Z'),
};

describe('isCheckinOpen', () => {
  it('always-mode open at start of KL day', () => expect(isCheckinOpen(always, new Date('2026-10-17T16:30:00Z'))).toBe(true));
  it('always-mode closed next KL day', () => expect(isCheckinOpen(always, new Date('2026-10-18T16:30:00Z'))).toBe(false));
  it('window open at exact start', () => expect(isCheckinOpen(win, new Date('2026-10-18T11:00:00Z'))).toBe(true));
  it('window open at exact end', () => expect(isCheckinOpen(win, new Date('2026-10-18T13:00:00Z'))).toBe(true));
  it('window closed one minute after end', () => expect(isCheckinOpen(win, new Date('2026-10-18T13:01:00Z'))).toBe(false));
  it('window without bounds is closed', () => expect(isCheckinOpen({ ...win, windowEnd: undefined }, new Date('2026-10-18T12:00:00Z'))).toBe(false));
});

describe('resolveCurrentMeeting', () => {
  it('prefers sunday when several are open', () => {
    expect(resolveCurrentMeeting([win, always], new Date('2026-10-18T12:00:00Z'))?.id).toBe('sunday-2026-10-18');
  });
  it('returns null for empty list', () => expect(resolveCurrentMeeting([], new Date())).toBeNull());
  it('returns null when none open', () => expect(resolveCurrentMeeting([win], new Date('2026-10-19T12:00:00Z'))).toBeNull());
});

describe('attendanceId', () => {
  it('joins meeting and person', () => expect(attendanceId('m1', 'p1')).toBe('m1_p1'));
});
