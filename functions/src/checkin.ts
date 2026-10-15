import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, REGION, meetingsOn, toMeeting } from './lib/admin';
import { requireUser } from './lib/auth';
import { klDate } from '../../shared/dates';
import { attendanceId, isCheckinOpen, resolveCurrentMeeting } from '../../shared/checkin';
import type { Meeting } from '../../shared/types';

interface Req { meetingId?: string; personIds: string[] }
interface Res { meetingId: string; meetingTitle: string; results: { personId: string; status: 'ok' | 'already' }[] }

export const selfCheckIn = onCall<Req, Promise<Res>>({ region: REGION }, async (request) => {
  const user = await requireUser(request);
  const ids = Array.isArray(request.data?.personIds) ? [...new Set(request.data.personIds.filter((x) => typeof x === 'string'))] : [];
  if (ids.length === 0 || ids.length > 20) throw new HttpsError('invalid-argument', 'checkin.noPeople');

  const people = await db.getAll(...ids.map((id) => db.doc(`people/${id}`)));
  if (people.some((p) => !p.exists || p.get('householdId') !== user.householdId || p.get('active') === false)) {
    throw new HttpsError('permission-denied', 'checkin.notYourFamily');
  }

  const now = new Date();
  let meeting: Meeting | null;
  if (request.data.meetingId) {
    const snap = await db.doc(`meetings/${request.data.meetingId}`).get();
    if (!snap.exists) throw new HttpsError('not-found', 'checkin.noMeeting');
    meeting = toMeeting(snap);
    if (!isCheckinOpen(meeting, now)) throw new HttpsError('failed-precondition', 'checkin.closed');
  } else {
    meeting = resolveCurrentMeeting(await meetingsOn(klDate(now)), now);
    if (!meeting) throw new HttpsError('failed-precondition', 'checkin.noMeeting');
  }
  const m = meeting;

  const results = await Promise.all(
    ids.map(async (personId) => {
      try {
        await db.doc(`attendance/${attendanceId(m.id, personId)}`).create({
          meetingId: m.id, personId, date: m.date, method: 'self', byUid: user.uid, at: FieldValue.serverTimestamp(),
        });
        return { personId, status: 'ok' as const };
      } catch (e: any) {
        if (e?.code === 6) return { personId, status: 'already' as const }; // ALREADY_EXISTS
        throw e;
      }
    }),
  );
  return { meetingId: m.id, meetingTitle: m.title, results };
});
