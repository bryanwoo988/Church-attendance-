import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';
import { authErrorKey, detailFor } from './authErrors';

const RESEND_SECONDS = 60;

export default function LoginPage() {
  const { t } = useT();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The number the code was sent to (E.164); null until a code is sent.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setDetail(null);
    const p = normalizeMyPhone(phone);
    if (!p.ok) {
      setError('login.invalidPhone');
      return;
    }
    setBusy(true);
    try {
      // The server texts the code (Twilio Verify) and applies the daily per-number limit.
      await call('requestLoginCode', { phone: p.e164 });
      setSentTo(p.e164);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(authErrorKey(err));
      setDetail(detailFor(authErrorKey(err), err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setDetail(null);
    setBusy(true);
    try {
      const { token } = await call<object, { token: string }>('verifyLoginCode', { phone: sentTo, code: code.trim() });
      await signInWithCustomToken(auth, token);
      const next = params.get('next');
      nav(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      setError(authErrorKey(err));
      setDetail(detailFor(authErrorKey(err), err));
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h1>{t('login.title')}</h1>
      {!sentTo ? (
        <form onSubmit={sendCode}>
          <label htmlFor="phone">{t('login.phone')}</label>
          <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="muted">{t('login.phoneHint')}</p>
          {error && <p className="err" role="alert">{t(error)}{detail && <small className="muted"> ({detail})</small>}</p>}
          <button type="submit" className="btn primary block" disabled={busy}>{t('login.sendCode')}</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p>{t('login.codeSent', { phone })}</p>
          <label htmlFor="code">{t('login.code')}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          {error && <p className="err" role="alert">{t(error)}{detail && <small className="muted"> ({detail})</small>}</p>}
          <button type="submit" className="btn primary block" disabled={busy || code.length !== 6}>{t('login.verify')}</button>
          <button type="button" className="btn block" style={{ marginTop: 8 }} disabled={busy || wait > 0} onClick={() => sendCode()}>
            {wait > 0 ? t('login.resendIn', { s: wait }) : t('login.resend')}
          </button>
          <button type="button" className="btn block" style={{ marginTop: 8 }} onClick={() => { setSentTo(null); setCode(''); }}>
            {t('login.changePhone')}
          </button>
        </form>
      )}
    </div>
  );
}
