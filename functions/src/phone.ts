import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, REGION } from './lib/admin';
import { requireUser } from './lib/auth';
import { mergeInto } from './admin';
import { normalizeMyPhone } from '../../shared/phone';

/**
 * After the app has verified a new number with SMS (Firebase updatePhoneNumber), copy it onto the
 * caller's person record. An earlier newcomer record with that number is the same human, so it is
 * merged in; a number owned by another account is refused.
 */
export const syncMyPhone = onCall({ region: REGION }, async (request) => {
  const user = await requireUser(request);
  const raw = request.auth?.token.phone_number;
  const phone = raw ? normalizeMyPhone(raw) : null;
  if (!phone?.ok) throw new HttpsError('failed-precondition', 'phone.noPhone');

  const same = await db.collection('people').where('phone', '==', phone.e164).get();
  const others = same.docs.filter((d) => d.id !== user.personId && d.get('active') !== false);
  if (others.some((d) => d.get('accountUid'))) throw new HttpsError('failed-precondition', 'phone.inUse');

  for (const o of others) await mergeInto(o.id, user.personId);
  await db.doc(`people/${user.personId}`).update({ phone: phone.e164 });
  return { phone: phone.e164, merged: others.length };
});
