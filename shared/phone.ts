export type PhoneResult = { ok: true; e164: string } | { ok: false; error: 'invalid' };

const MOBILE = /^(01[0-46-9]\d{7}|011\d{8})$/;

/** Normalize a Malaysian mobile number to E.164 (+60…). Landlines and foreign numbers are rejected. */
export function normalizeMyPhone(input: string): PhoneResult {
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return { ok: false, error: 'invalid' };
  let local: string;
  if (digits.startsWith('60')) local = '0' + digits.slice(2);
  else if (digits.startsWith('0')) local = digits;
  else return { ok: false, error: 'invalid' };
  if (!MOBILE.test(local)) return { ok: false, error: 'invalid' };
  return { ok: true, e164: '+60' + local.slice(1) };
}
