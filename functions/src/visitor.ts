import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, REGION, IS_EMULATOR, meetingsOn } from './lib/admin';
import { normalizeMyPhone } from '../../shared/phone';
import { klDate } from '../../shared/dates';
import { attendanceId, resolveCurrentMeeting } from '../../shared/checkin';

interface Req {
  name: string;
  phone: string;
  familyNames?: string[];
  howHeard?: string;
  contactConsent: boolean;
  pdpaConsent: boolean;
}
interface Res { personId: string; visitNumber: number; checkedIn: boolean }

const MAX_PER_DAY = 5;

/** Rate-limit key that does not store the phone number itself. */
const rateKey = (e164: string, date: string) => createHash('sha256').update(`${e164}|${date}`).digest('hex').slice(0, 32);

export const submitVisitorForm = onCall<Req, Promise<Res>>({ region: REGION, enforceAppCheck: !IS_EMULATOR }, async (request) => {
  const d = request.data ?? ({} as Req);
  if (d.pdpaConsent !== true) throw new HttpsError('invalid-argument', 'welcome.pdpaRequired');
  const name = typeof d.name === 'string' ? d.name.trim().slice(0, 80) : '';
  if (!name) throw new HttpsError('invalid-argument', 'welcome.nameRequired');
  const phone = normalizeMyPhone(typeof d.phone === 'string' ? d.phone : '');
  if (!phone.ok) throw new HttpsError('invalid-argument', 'welcome.invalidPhone');
  const familyNames = (Array.isArray(d.familyNames) ? d.familyNames : [])
    .filter((n): n is string => typeof n === 'string')
    .map((n) => n.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 10);
  const howHeard = typeof d.howHeard === 'string' ? d.howHeard.slice(0, 40) : null;

  const now = new Date();
  const today = klDate(now);
  const meeting = resolveCurrentMeeting(await meetingsOn(today), now);

  return db.runTransaction(async (tx) => {
    // --- reads ---
    const rlRef = db.doc(`rateLimits/visitor_${rateKey(phone.e164, today)}`);
    const rl = await tx.get(rlRef);
    const count = (rl.get('count') as number | undefined) ?? 0;
    if (count >= MAX_PER_DAY) throw new HttpsError('resource-exhausted', 'welcome.tooMany');

    const matches = await tx.get(db.collection('people').where('phone', '==', phone.e164));
    const found = matches.docs.find((p) => p.get('active') !== false);
    let existingFamily: { id: string; name: string }[] = [];
    if (found) {
      const fam = await tx.get(db.collection('people').where('householdId', '==', found.get('householdId')));
      existingFamily = fam.docs
        .filter((p) => p.id !== found.id && p.get('active') !== false)
        .map((p) => ({ id: p.id, name: p.get('name') }));
    }
    // A known phone may only check in itself and family members that already exist; strangers who
    // know a member's number cannot add people to that household or change their consent.
    const matchedFamily = found
      ? familyNames.map((n) => existingFamily.find((f) => f.name.toLowerCase() === n.toLowerCase())).filter((f): f is { id: string; name: string } => !!f)
      : [];
    const existingAttendees = found ? [found.id, ...matchedFamily.map((f) => f.id)] : [];
    const already = new Set<string>();
    if (meeting) {
      for (const pid of existingAttendees) {
        if ((await tx.get(db.doc(`attendance/${attendanceId(meeting.id, pid)}`))).exists) already.add(pid);
      }
    }

    // --- writes ---
    let personId: string;
    let visitNumber: number;
    const attendees: string[] = [];
    if (found) {
      personId = found.id;
      const prev = (found.get('visitCount') as number | undefined) ?? 0;
      visitNumber = found.get('lastVisitDate') === today ? Math.max(prev, 1) : prev + 1;
      tx.update(found.ref, {
        visitCount: visitNumber,
        lastVisitDate: today,
        firstVisitDate: found.get('firstVisitDate') ?? today,
        ...(found.get('pdpaConsentAt') ? {} : { pdpaConsentAt: FieldValue.serverTimestamp() }),
      });
      attendees.push(...existingAttendees);
    } else {
      const hRef = db.collection('households').doc();
      const pRef = db.collection('people').doc();
      const householdId = hRef.id;
      personId = pRef.id;
      visitNumber = 1;
      tx.set(hRef, { createdAt: FieldValue.serverTimestamp() });
      tx.set(pRef, {
        name, phone: phone.e164, householdId, kind: 'adult', status: 'visitor', visitCount: 1,
        firstVisitDate: today, lastVisitDate: today, howHeard, contactConsent: d.contactConsent === true,
        pdpaConsentAt: FieldValue.serverTimestamp(), active: true, createdAt: FieldValue.serverTimestamp(),
      });
      attendees.push(personId);
      for (const fname of familyNames) {
        const ref = db.collection('people').doc();
        tx.set(ref, {
          name: fname, householdId, kind: 'adult', status: 'visitor', visitCount: 1,
          firstVisitDate: today, lastVisitDate: today, active: true, createdAt: FieldValue.serverTimestamp(),
        });
        attendees.push(ref.id);
      }
    }

    if (meeting) {
      for (const pid of attendees) {
        if (already.has(pid)) continue;
        tx.create(db.doc(`attendance/${attendanceId(meeting.id, pid)}`), {
          meetingId: meeting.id, personId: pid, date: today, method: 'visitorForm', at: FieldValue.serverTimestamp(),
        });
      }
    }
    tx.set(rlRef, { count: count + 1, expiresAt: new Date(now.getTime() + 2 * 86_400_000) });
    return { personId, visitNumber, checkedIn: meeting !== null };
  });
});
