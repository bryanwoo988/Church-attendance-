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
    const rlRef = db.doc(`rateLimits/visitor_${phone.e164}_${today}`);
    const rl = await tx.get(rlRef);
    const count = (rl.get('count') as number | undefined) ?? 0;
    if (count >= MAX_PER_DAY) throw new HttpsError('resource-exhausted', 'welcome.tooMany');

    const matches = await tx.get(db.collection('people').where('phone', '==', phone.e164));
    const found = matches.docs.find((p) => p.get('active') !== false);

    let personId: string;
    let householdId: string;
    let visitNumber: number;
    let existingFamily: { id: string; name: string }[] = [];

    if (found) {
      personId = found.id;
      householdId = found.get('householdId');
      const prev = (found.get('visitCount') as number | undefined) ?? 0;
      const sameDay = found.get('lastVisitDate') === today;
      visitNumber = sameDay ? Math.max(prev, 1) : prev + 1;
      const fam = await tx.get(db.collection('people').where('householdId', '==', householdId));
      existingFamily = fam.docs.filter((p) => p.id !== personId).map((p) => ({ id: p.id, name: p.get('name') }));
      tx.update(found.ref, {
        visitCount: visitNumber,
        lastVisitDate: today,
        firstVisitDate: found.get('firstVisitDate') ?? today,
        contactConsent: d.contactConsent === true,
        pdpaConsentAt: FieldValue.serverTimestamp(),
        ...(howHeard ? { howHeard } : {}),
      });
    } else {
      const hRef = db.collection('households').doc();
      const pRef = db.collection('people').doc();
      householdId = hRef.id;
      personId = pRef.id;
      visitNumber = 1;
      tx.set(hRef, { createdAt: FieldValue.serverTimestamp() });
      tx.set(pRef, {
        name, phone: phone.e164, householdId, kind: 'adult', status: 'visitor', visitCount: 1,
        firstVisitDate: today, lastVisitDate: today, howHeard, contactConsent: d.contactConsent === true,
        pdpaConsentAt: FieldValue.serverTimestamp(), active: true, createdAt: FieldValue.serverTimestamp(),
      });
    }

    const attendees = [personId];
    for (const fname of familyNames) {
      const known = existingFamily.find((f) => f.name.toLowerCase() === fname.toLowerCase());
      if (known) {
        attendees.push(known.id);
        continue;
      }
      const ref = db.collection('people').doc();
      tx.set(ref, {
        name: fname, householdId, kind: 'adult', status: 'visitor', visitCount: 1,
        firstVisitDate: today, lastVisitDate: today, active: true, createdAt: FieldValue.serverTimestamp(),
      });
      attendees.push(ref.id);
    }

    if (meeting) {
      for (const pid of attendees) {
        const aRef = db.doc(`attendance/${attendanceId(meeting.id, pid)}`);
        tx.set(aRef, { meetingId: meeting.id, personId: pid, date: today, method: 'visitorForm', at: FieldValue.serverTimestamp() }, { merge: true });
      }
    }
    tx.set(rlRef, { count: count + 1, expiresAt: new Date(now.getTime() + 2 * 86_400_000) });
    return { personId, visitNumber, checkedIn: meeting !== null };
  });
});
