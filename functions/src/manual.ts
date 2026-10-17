import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, REGION, toMeeting } from './lib/admin';
import { requireUser } from './lib/auth';
import { normalizeMyPhone } from '../../shared/phone';
import { attendanceId } from '../../shared/checkin';

interface Req { meetingId: string; name: string; phone?: string; kind: 'adult' | 'child' }
interface Res { personId: string; status: 'ok' | 'already'; created: boolean }

/**
 * Door scanner checks in someone with no QR code (usually a first-time visitor).
 * A known phone reuses that person, so a returning visitor is never duplicated.
 */
export const scannerAddVisitor = onCall<Req, Promise<Res>>({ region: REGION, invoker: 'public' }, async (request) => {
  const user = await requireUser(request);
  const d = request.data ?? ({} as Req);
  const meetingSnap = typeof d.meetingId === 'string' && d.meetingId ? await db.doc(`meetings/${d.meetingId}`).get() : null;
  if (!meetingSnap?.exists) throw new HttpsError('not-found', 'checkin.noMeeting');
  const meeting = toMeeting(meetingSnap);

  // Same rule as door scanning: scanners and admins anywhere, leaders only at their own group's meetings.
  let allowed = user.roles.includes('scanner') || user.roles.includes('admin');
  if (!allowed && user.roles.includes('leader') && meeting.groupId) {
    const g = await db.doc(`groups/${meeting.groupId}`).get();
    allowed = ((g.get('leaderUids') as string[] | undefined) ?? []).includes(user.uid);
  }
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed');

  const name = typeof d.name === 'string' ? d.name.trim().slice(0, 80) : '';
  if (!name) throw new HttpsError('invalid-argument', 'welcome.nameRequired');
  const kind = d.kind === 'child' ? 'child' : 'adult';
  const rawPhone = typeof d.phone === 'string' ? d.phone.trim() : '';
  let e164: string | undefined;
  if (rawPhone) {
    const phone = normalizeMyPhone(rawPhone);
    if (!phone.ok) throw new HttpsError('invalid-argument', 'welcome.invalidPhone');
    e164 = phone.e164;
  }

  return db.runTransaction(async (tx) => {
    const found = e164
      ? (await tx.get(db.collection('people').where('phone', '==', e164))).docs.find((p) => p.get('active') !== false)
      : undefined;
    const pRef = found ? found.ref : db.collection('people').doc();
    const aRef = db.doc(`attendance/${attendanceId(meeting.id, pRef.id)}`);
    if (found && (await tx.get(aRef)).exists) return { personId: pRef.id, status: 'already' as const, created: false };

    if (!found) {
      const hRef = db.collection('households').doc();
      tx.set(hRef, { createdAt: FieldValue.serverTimestamp() });
      tx.set(pRef, {
        name, householdId: hRef.id, kind, status: 'visitor', visitCount: 1,
        firstVisitDate: meeting.date, lastVisitDate: meeting.date, active: true, createdAt: FieldValue.serverTimestamp(),
        ...(e164 ? { phone: e164 } : {}),
      });
    }
    tx.create(aRef, { meetingId: meeting.id, personId: pRef.id, date: meeting.date, method: 'scanner', byUid: user.uid, at: FieldValue.serverTimestamp() });
    return { personId: pRef.id, status: 'ok' as const, created: !found };
  });
});
