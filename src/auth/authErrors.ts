import type { MessageKey } from '../i18n';

export function errorCode(e: unknown): string {
  return String((e as { code?: string })?.code ?? '');
}

export function authErrorKey(e: unknown): MessageKey {
  const code = errorCode(e);
  if (code === 'auth/invalid-verification-code') return 'login.wrongCode';
  if (code === 'auth/code-expired') return 'login.codeExpired';
  if (code === 'auth/too-many-requests') return 'login.tooMany';
  if (code === 'auth/invalid-phone-number') return 'login.invalidPhone';
  if (code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential') return 'phone.inUse';
  if (code === 'auth/requires-recent-login') return 'phone.reLogin';
  return 'common.error';
}

/** Code to show next to a generic message so problems can be diagnosed from a screenshot. */
export function detailFor(key: MessageKey, e: unknown): string | null {
  const code = errorCode(e) || (e as { message?: string })?.message || '';
  return key === 'common.error' && code ? code : null;
}
