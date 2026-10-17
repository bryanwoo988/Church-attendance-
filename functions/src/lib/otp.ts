import { HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { createHash } from 'node:crypto';
import { db, FieldValue, IS_EMULATOR } from './admin';
import { klDate } from '../../../shared/dates';
import { normalizeMyPhone } from '../../../shared/phone';
import { DEFAULT_SETTINGS } from '../../../shared/types';

/** Twilio Verify sends and checks the codes; we never see or store them. */
export const TWILIO_API_KEY_SID = defineSecret('TWILIO_API_KEY_SID');
export const TWILIO_API_KEY_SECRET = defineSecret('TWILIO_API_KEY_SECRET');
const VERIFY_SERVICE_SID = defineString('TWILIO_VERIFY_SERVICE_SID');
export const OTP_SECRETS = [TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET];

/** Local emulator only: no SMS is sent and the code is always this. */
export const FAKE_CODE = '123456';

export function requirePhone(raw: unknown): string {
  const p = normalizeMyPhone(typeof raw === 'string' ? raw : '');
  if (!p.ok) throw new HttpsError('invalid-argument', 'login.invalidPhone');
  return p.e164;
}

/** Count one code request for this number today; refuse past the admin-set daily limit. */
export async function consumeDailyQuota(e164: string): Promise<void> {
  const settings = await db.doc('settings/church').get();
  const limit = Number(settings.get('otpPerPhonePerDay')) || DEFAULT_SETTINGS.otpPerPhonePerDay!;
  const now = new Date();
  // The doc id is a hash, so the rate-limit collection never holds phone numbers.
  const key = createHash('sha256').update(`otp|${e164}|${klDate(now)}`).digest('hex').slice(0, 32);
  const ref = db.doc(`rateLimits/otp_${key}`);
  await db.runTransaction(async (tx) => {
    const count = ((await tx.get(ref)).get('count') as number | undefined) ?? 0;
    if (count >= limit) throw new HttpsError('resource-exhausted', 'login.tooMany');
    tx.set(ref, { count: count + 1, expiresAt: new Date(now.getTime() + 2 * 86_400_000) });
  });
}

async function twilio(path: string, form: Record<string, string>): Promise<{ status: number; body: any }> {
  const auth = Buffer.from(`${TWILIO_API_KEY_SID.value()}:${TWILIO_API_KEY_SECRET.value()}`).toString('base64');
  const res = await fetch(`https://verify.twilio.com/v2/Services/${VERIFY_SERVICE_SID.value()}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** Map Twilio Verify error codes to our message keys; log the rest for diagnosis. */
function sendError(status: number, body: any): HttpsError {
  const code = Number(body?.code);
  if (status === 429 || code === 60203) return new HttpsError('resource-exhausted', 'login.tooMany');
  if (code === 60200 || code === 21211 || code === 21614) return new HttpsError('invalid-argument', 'login.invalidPhone');
  if (code === 60410 || code === 60605) return new HttpsError('permission-denied', 'login.blocked');
  console.error('twilio send failed', status, code, body?.message);
  return new HttpsError('unavailable', 'login.sendFailed');
}

export async function sendCode(e164: string): Promise<void> {
  if (IS_EMULATOR) {
    await db.doc(`_fakeOtp/${e164}`).set({ at: FieldValue.serverTimestamp() });
    return;
  }
  const r = await twilio('Verifications', { To: e164, Channel: 'sms' });
  if (r.status >= 300) throw sendError(r.status, r.body);
}

/** Throws unless the code is right. A code works once; Twilio expires it after 10 minutes / 5 wrong tries. */
export async function checkCode(e164: string, rawCode: unknown): Promise<void> {
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!/^\d{4,10}$/.test(code)) throw new HttpsError('invalid-argument', 'login.wrongCode');
  if (IS_EMULATOR) {
    const ref = db.doc(`_fakeOtp/${e164}`);
    if (!(await ref.get()).exists) throw new HttpsError('not-found', 'login.codeExpired');
    if (code !== FAKE_CODE) throw new HttpsError('invalid-argument', 'login.wrongCode');
    await ref.delete();
    return;
  }
  const r = await twilio('VerificationCheck', { To: e164, Code: code });
  if (r.status === 404 || Number(r.body?.code) === 20404 || Number(r.body?.code) === 60202) {
    throw new HttpsError('not-found', 'login.codeExpired');
  }
  if (r.status >= 300) {
    console.error('twilio check failed', r.status, r.body?.code, r.body?.message);
    throw new HttpsError('unavailable', 'login.sendFailed');
  }
  if (r.body?.status !== 'approved') throw new HttpsError('invalid-argument', 'login.wrongCode');
}
