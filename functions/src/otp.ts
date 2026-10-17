import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { IS_EMULATOR, REGION } from './lib/admin';
import { requireUser } from './lib/auth';
import { OTP_SECRETS, checkCode, consumeDailyQuota, requirePhone, sendCode } from './lib/otp';
import { applyMyPhone, phoneClaims } from './phone';

const PUBLIC = { region: REGION, invoker: 'public' as const, secrets: OTP_SECRETS };
// Login is open to anyone, so require App Check (the real app) to keep bots from burning SMS credit.
const LOGIN = { ...PUBLIC, enforceAppCheck: !IS_EMULATOR };

async function authUidForPhone(e164: string): Promise<string | null> {
  try {
    return (await getAuth().getUserByPhoneNumber(e164)).uid;
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') return null;
    throw e;
  }
}

export const requestLoginCode = onCall(LOGIN, async (request) => {
  const e164 = requirePhone(request.data?.phone);
  await consumeDailyQuota(e164);
  await sendCode(e164);
  return { sent: true };
});

/** Right code → a sign-in token for the account with this number (created on first login). */
export const verifyLoginCode = onCall(LOGIN, async (request) => {
  const e164 = requirePhone(request.data?.phone);
  await checkCode(e164, request.data?.code);
  const uid = (await authUidForPhone(e164)) ?? (await getAuth().createUser({ phoneNumber: e164 })).uid;
  return { uid, token: await getAuth().createCustomToken(uid) };
});

export const requestPhoneChangeCode = onCall(PUBLIC, async (request) => {
  const user = await requireUser(request);
  const e164 = requirePhone(request.data?.phone);
  if ((await getAuth().getUser(user.uid)).phoneNumber === e164) throw new HttpsError('invalid-argument', 'phone.same');
  await consumeDailyQuota(e164);
  await sendCode(e164);
  return { sent: true };
});

export const confirmPhoneChange = onCall(PUBLIC, async (request) => {
  const user = await requireUser(request);
  const e164 = requirePhone(request.data?.phone);
  const owner = await authUidForPhone(e164);
  if (owner && owner !== user.uid) throw new HttpsError('failed-precondition', 'phone.inUse');
  await phoneClaims(user, e164);
  await checkCode(e164, request.data?.code);
  await getAuth().updateUser(user.uid, { phoneNumber: e164 });
  return { phone: e164, merged: await applyMyPhone(user, e164) };
});
