import { klDate, klDateTime } from './dates';
import type { ChurchSettings, Meeting } from './types';

export const SUNDAY_TITLE = '主日崇拜 Sunday Service';

/** The weekly service on or after `now` (KL calendar), per church settings. */
export function sundayMeetingFor(settings: ChurchSettings, now: Date): Meeting {
  const today = klDate(now);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const add = (settings.sunday.weekday - dow + 7) % 7;
  const date = new Date(Date.parse(`${today}T00:00:00Z`) + add * 86_400_000).toISOString().slice(0, 10);
  const m: Meeting = { id: `sunday-${date}`, type: 'sunday', title: SUNDAY_TITLE, date, checkinMode: settings.sunday.checkinMode };
  if (m.checkinMode === 'window') {
    m.windowStart = klDateTime(date, settings.sunday.start);
    m.windowEnd = klDateTime(date, settings.sunday.end);
  }
  return m;
}
