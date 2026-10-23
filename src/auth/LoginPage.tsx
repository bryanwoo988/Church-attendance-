import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { signInWithCustomToken } from 'firebase/auth';
import { HandCoins, History, ScanQrCode, Users } from 'lucide-react';
import { auth, call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';
import { authErrorKey, detailFor } from './authErrors';

const RESEND_SECONDS = 60;

/** The +60 is fixed in front of the field, so accept the number with or without its leading 0 or 60. */
function withCountryCode(input: string): string {
  let d = input.replace(/[\s\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('60')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return '+60' + d;
}

/** +60123456789 → "+60 12-345 6789"; +601123456789 → "+60 11-2345 6789". */
export function formatMyPhone(e164: string): string {
  const l = e164.slice(3);
  const rest = l.slice(2);
  return `+60 ${l.slice(0, 2)}-${rest.length === 8 ? `${rest.slice(0, 4)} ${rest.slice(4)}` : `${rest.slice(0, 3)} ${rest.slice(3)}`}`;
}

export default function LoginPage() {
  const { t, lang, setLang } = useT();
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
    const p = normalizeMyPhone(withCountryCode(phone));
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

  const errorBox = error && <p className="err" role="alert">{t(error)}{detail && <small className="muted"> ({detail})</small>}</p>;

  return (
    <div className="login">
      <section className="login-hero">
        <img className="login-logo" src="/icons/icon-192.png" alt="" width={72} height={72} />
        <p className="login-welcome">{t('login.welcome')}</p>
        <h1 className="login-title">{t('app.title')}</h1>
        <p className="muted">{t('login.intro')}</p>
        <ul className="login-features">
          <li><ScanQrCode size={22} aria-hidden />{t('login.f1')}</li>
          <li><Users size={22} aria-hidden />{t('login.f2')}</li>
          <li><History size={22} aria-hidden />{t('login.f3')}</li>
          <li><HandCoins size={22} aria-hidden />{t('login.f4')}</li>
        </ul>
      </section>

      <section className="login-sheet">
        {!sentTo ? (
          <form onSubmit={sendCode} noValidate>
            <label htmlFor="phone" className="sr-only">{t('login.phone')}</label>
            <div className="phone-field">
              <span className="phone-cc" aria-label={t('login.country')}><span aria-hidden>🇲🇾</span> +60</span>
              <input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={t('login.phonePlaceholder')}
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <p className="muted small">{t('login.phoneHint')}</p>
            {errorBox}
            <button type="submit" className="btn primary block" disabled={busy || phone.replace(/\D/g, '').length < 8}>{t('login.sendCode')}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h2 className="login-code-title">{t('login.codeTitle')}</h2>
            <p className="muted">{t('login.codeSent', { phone: formatMyPhone(sentTo) })}</p>
            <label htmlFor="code" className="sr-only">{t('login.code')}</label>
            <input id="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            {errorBox}
            <button type="submit" className="btn primary block" disabled={busy || code.length !== 6}>{t('login.verify')}</button>
            <div className="grid2" style={{ marginTop: 8 }}>
              <button type="button" className="btn" disabled={busy || wait > 0} onClick={() => sendCode()}>
                {wait > 0 ? t('login.resendIn', { s: wait }) : t('login.resend')}
              </button>
              <button type="button" className="btn" onClick={() => { setSentTo(null); setCode(''); setError(null); }}>
                {t('login.changePhone')}
              </button>
            </div>
          </form>
        )}
        <p className="login-lang">
          {t('login.switchLang')} <button type="button" className="linkish" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>{t('login.otherLang')}</button>
        </p>
      </section>
    </div>
  );
}
