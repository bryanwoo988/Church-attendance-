import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, FieldValue, REGION } from './lib/admin';
import { requireRole } from './lib/auth';
import { sundayMeetingFor } from '../../shared/sunday';
import { DEFAULT_SETTINGS, type ChurchSettings } from '../../shared/types';

async function ensureSunday(now: Date): Promise<string> {
  const snap = await db.doc('settings/church').get();
  const settings: ChurchSettings = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<ChurchSettings> | undefined) };
  const m = sundayMeetingFor(settings, now);
  try {
    await db.doc(`meetings/${m.id}`).create({
      type: m.type, title: m.title, date: m.date, checkinMode: m.checkinMode,
      ...(m.windowStart ? { windowStart: m.windowStart, windowEnd: m.windowEnd } : {}),
      createdBy: 'system', createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    if (e?.code !== 6) throw e; // already exists
  }
  return m.id;
}

export const createUpcomingSunday = onSchedule(
  { schedule: 'every saturday 00:05', timeZone: 'Asia/Kuala_Lumpur', region: REGION },
  async () => {
    await ensureSunday(new Date());
  },
);

export const createSundayNow = onCall({ region: REGION }, async (request) => {
  await requireRole(request, ['admin']);
  return { meetingId: await ensureSunday(new Date()) };
});
