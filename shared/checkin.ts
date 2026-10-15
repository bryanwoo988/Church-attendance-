import { klDate } from './dates';
import type { Meeting } from './types';

export function attendanceId(meetingId: string, personId: string): string {
  return `${meetingId}_${personId}`;
}

export function isCheckinOpen(m: Meeting, now: Date): boolean {
  if (m.checkinMode === 'always') return klDate(now) === m.date;
  if (!m.windowStart || !m.windowEnd) return false;
  const t = now.getTime();
  return t >= m.windowStart.getTime() && t <= m.windowEnd.getTime();
}

/** The meeting a fixed check-in poster should resolve to right now. */
export function resolveCurrentMeeting(meetings: Meeting[], now: Date): Meeting | null {
  const open = meetings.filter((m) => isCheckinOpen(m, now));
  if (open.length === 0) return null;
  const rank = (m: Meeting) => (m.type === 'sunday' ? 0 : 1);
  open.sort((a, b) => rank(a) - rank(b) || (a.windowStart?.getTime() ?? 0) - (b.windowStart?.getTime() ?? 0));
  return open[0];
}
