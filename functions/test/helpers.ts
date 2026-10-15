import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export const PROJECT = 'demo-church';
const BASE = `http://127.0.0.1:5001/${PROJECT}/asia-southeast1`;

if (!getApps().length) initializeApp({ projectId: PROJECT });
export const db = getFirestore();

function b64url(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/** Unsigned ID token; the Functions emulator accepts these when the Auth emulator is running. */
export function fakeIdToken(uid: string, phone?: string) {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'none', typ: 'JWT' }),
    b64url({
      iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
      sub: uid, user_id: uid, phone_number: phone,
      firebase: { identities: phone ? { phone: [phone] } : {}, sign_in_provider: 'phone' },
    }),
    '',
  ].join('.');
}

export type CallResult<T> = { ok: true; data: T } | { ok: false; status: string; message: string };

export async function callFn<T = any>(name: string, data: unknown, auth?: { uid: string; phone?: string }): Promise<CallResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${fakeIdToken(auth.uid, auth.phone)}`;
  const res = await fetch(`${BASE}/${name}`, { method: 'POST', headers, body: JSON.stringify({ data }) });
  const body = (await res.json()) as any;
  if (body.error) return { ok: false, status: body.error.status, message: body.error.message };
  return { ok: true, data: body.result as T };
}

export async function clearDb() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

export { Timestamp };
