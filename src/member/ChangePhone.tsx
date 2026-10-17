import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PhoneAuthProvider, RecaptchaVerifier, updatePhoneNumber } from 'firebase/auth';
import { auth, call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';
import { authErrorKey, detailFor } from '../auth/authErrors';
import { errorKey } from '../data';

/** Change the signed-in user's phone: SMS-verify the new number, then sync it to their record. */
export default function ChangePhone({ current }: { current?: string }) {
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => verifier.current?.clear(), []);

  function fail(key: MessageKey, e: unknown) {
    setError(key);
    setDetail(detailFor(key, e));
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDetail(null);
    const p = normalizeMyPhone(phone);
    if (!p.ok) return setError('login.invalidPhone');
    if (p.e164 === current) return setError('phone.same');
    setBusy(true);
    try {
      verifier.current ??= new RecaptchaVerifier(auth, 'recaptcha-change', { size: 'invisible' });
      setVerificationId(await new PhoneAuthProvider(auth).verifyPhoneNumber(p.e164, verifier.current));
    } catch (err) {
      fail(authErrorKey(err), err);
      verifier.current?.clear();
      verifier.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!verificationId || !auth.currentUser) return;
    setError(null);
    setDetail(null);
    setBusy(true);
    try {
      await updatePhoneNumber(auth.currentUser, PhoneAuthProvider.credential(verificationId, code.trim()));
    } catch (err) {
      setBusy(false);
      return fail(authErrorKey(err), err);
    }
    try {
      await auth.currentUser.getIdToken(true);
      const r = await call<object, { phone: string }>('syncMyPhone', {});
      setDone(r.phone);
    } catch (err) {
      fail(errorKey(err) === 'phone.inUse' ? 'phone.inUse' : 'common.error', err);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="ok">{t('phone.done', { phone: done })}</p>;

  return (
    <div>
      {!verificationId ? (
        <form onSubmit={send} noValidate>
          <label htmlFor="new-phone">{t('phone.new')}</label>
          <input id="new-phone" type="tel" inputMode="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {error && <p className="err" role="alert">{t(error)}{detail && <small className="muted"> ({detail})</small>}</p>}
          <button type="submit" className="btn block" style={{ marginTop: 10 }} disabled={busy}>{t('login.sendCode')}</button>
        </form>
      ) : (
        <form onSubmit={confirm} noValidate>
          <p>{t('login.codeSent', { phone })}</p>
          <label htmlFor="new-code">{t('login.code')}</label>
          <input id="new-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          {error && <p className="err" role="alert">{t(error)}{detail && <small className="muted"> ({detail})</small>}</p>}
          <button type="submit" className="btn primary block" style={{ marginTop: 10 }} disabled={busy || code.length !== 6}>{t('phone.confirm')}</button>
          <button type="button" className="btn block" style={{ marginTop: 8 }} onClick={() => { setVerificationId(null); setCode(''); }}>{t('common.back')}</button>
        </form>
      )}
      <div id="recaptcha-change" />
    </div>
  );
}
