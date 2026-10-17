import type { MessageKey } from '../i18n';
import { errorKey } from '../data';

const KNOWN: MessageKey[] = [
  'login.invalidPhone', 'login.wrongCode', 'login.codeExpired', 'login.tooMany', 'login.blocked', 'login.sendFailed',
  'phone.same', 'phone.inUse',
];

export function errorCode(e: unknown): string {
  return String((e as { code?: string })?.code ?? '');
}

/** Message for a failed code request/check; the server names the reason (e.g. 'login.wrongCode'). */
export function authErrorKey(e: unknown): MessageKey {
  const k = errorKey(e) as MessageKey | null;
  return k && KNOWN.includes(k) ? k : 'common.error';
}

/** Code to show next to a generic message so problems can be diagnosed from a screenshot. */
export function detailFor(key: MessageKey, e: unknown): string | null {
  const twilio = (e as { details?: { twilio?: unknown } })?.details?.twilio;
  if (twilio) return `Twilio ${twilio}`;
  const code = errorCode(e) || (e as { message?: string })?.message || '';
  return key === 'common.error' && code ? code : null;
}
