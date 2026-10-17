import { useState, type FormEvent } from 'react';
import { auth, call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';
import { authErrorKey, detailFor } from '../auth/authErrors';

/** Change the signed-in user's phone: the server texts a code to the new number, then moves the account to it. */
export default function ChangePhone({ current }: { current?: string }) {
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function fail(e: unknown) {
    const key = authErrorKey(e);
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
      await call('requestPhoneChangeCode', { phone: p.e164 });
      setSentTo(p.e164);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setDetail(null);
    setBusy(true);
    try {
      const r = await call<object, { phone: string }>('confirmPhoneChange', { phone: sentTo, code: code.trim() });
      await auth.currentUser?.getIdToken(true); // pick up the new number in this session
      setDone(r.phone);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="ok">{t('phone.done', { phone: done })}</p>;

  return (
    <div>
      {!sentTo ? (
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
          <button type="button" className="btn block" style={{ marginTop: 8 }} onClick={() => { setSentTo(null); setCode(''); }}>{t('common.back')}</button>
        </form>
      )}
    </div>
  );
}
