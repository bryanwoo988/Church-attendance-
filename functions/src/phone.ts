import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { mergeInto } from './admin';
import type { UserDoc } from '../../shared/types';

/** People (other than me) already holding this number; refuse if one of them is another account. */
export async function phoneClaims(user: UserDoc, e164: string) {
  const same = await db.collection('people').where('phone', '==', e164).get();
  const others = same.docs.filter((d) => d.id !== user.personId && d.get('active') !== false);
  if (others.some((d) => d.get('accountUid'))) throw new HttpsError('failed-precondition', 'phone.inUse');
  return others;
}

/**
 * Put a verified number on the caller's person record. An earlier newcomer record with that number
 * is the same human, so it is merged in.
 */
export async function applyMyPhone(user: UserDoc, e164: string): Promise<number> {
  const others = await phoneClaims(user, e164);
  for (const o of others) await mergeInto(o.id, user.personId);
  await db.doc(`people/${user.personId}`).update({ phone: e164 });
  return others.length;
}
