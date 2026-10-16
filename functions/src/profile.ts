import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue, REGION } from './lib/admin';
import { requireAuth } from './lib/auth';
import { normalizeMyPhone } from '../../shared/phone';

interface Req { name?: string }
interface Res { personId?: string; householdId?: string; needsName: boolean }

export const ensureProfile = onCall<Req, Promise<Res>>({ region: REGION }, async (request) => {
  const uid = requireAuth(request);
  const existing = await db.doc(`users/${uid}`).get();
  if (existing.exists) {
    const d = existing.data()!;
    return { personId: d.personId, householdId: d.householdId, needsName: false };
  }
  const phoneRaw = request.auth?.token.phone_number;
  const phone = phoneRaw ? normalizeMyPhone(phoneRaw) : null;
  if (!phone?.ok) throw new HttpsError('failed-precondition', 'profile.noPhone');

  const name = typeof request.data?.name === 'string' ? request.data.name.trim().slice(0, 80) : '';

  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const again = await tx.get(userRef);
    if (again.exists) {
      const d = again.data()!;
      return { personId: d.personId, householdId: d.householdId, needsName: false };
    }
    const matches = await tx.get(db.collection('people').where('phone', '==', phone.e164));
    const match = matches.docs.find((p) => p.get('active') !== false && !p.get('accountUid'));

    let personId: string;
    let householdId: string;
    if (match) {
      personId = match.id;
      householdId = match.get('householdId');
      const hRef = db.doc(`households/${householdId}`);
      const owner = (await tx.get(hRef)).get('ownerUid');
      if (owner && owner !== uid) {
        // A family member with their own phone: give them their own household (转出) instead of taking over.
        const newH = db.collection('households').doc();
        householdId = newH.id;
        tx.set(newH, { ownerUid: uid, createdAt: FieldValue.serverTimestamp() });
        tx.update(match.ref, { accountUid: uid, householdId });
      } else {
        tx.update(match.ref, { accountUid: uid });
        tx.set(hRef, { ownerUid: uid }, { merge: true });
      }
    } else {
      if (!name) return { needsName: true };
      const hRef = db.collection('households').doc();
      const pRef = db.collection('people').doc();
      householdId = hRef.id;
      personId = pRef.id;
      tx.set(hRef, { ownerUid: uid, createdAt: FieldValue.serverTimestamp() });
      tx.set(pRef, {
        name, phone: phone.e164, accountUid: uid, householdId, kind: 'adult', status: 'visitor',
        visitCount: 0, active: true, createdAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(userRef, { personId, householdId, roles: [] });
    return { personId, householdId, needsName: false };
  });
});
