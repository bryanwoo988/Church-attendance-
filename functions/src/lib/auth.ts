import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import type { Role, UserDoc } from '../../../shared/types';

export function requireAuth(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  return request.auth.uid;
}

export async function requireUser(request: CallableRequest): Promise<UserDoc> {
  const uid = requireAuth(request);
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError('failed-precondition', 'profile.missing');
  const d = snap.data()!;
  return { uid, personId: d.personId, householdId: d.householdId, roles: d.roles ?? [] };
}

export async function requireRole(request: CallableRequest, roles: Role[]): Promise<UserDoc> {
  const user = await requireUser(request);
  if (!user.roles.some((r) => roles.includes(r))) throw new HttpsError('permission-denied', 'Not allowed');
  return user;
}
