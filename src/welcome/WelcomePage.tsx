import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';

const HOW: MessageKey[] = ['welcome.how.friend', 'welcome.how.family', 'welcome.how.online', 'welcome.how.passing', 'welcome.how.other'];

export default function WelcomePage() {
  const { t } = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [family, setFamily] = useState<string[]>([]);
  const [how, setHow] = useState('');
  const [contact, setContact] = useState(false);
  const [pdpa, setPdpa] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ visitNumber: number; checkedIn: boolean } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const p = normalizeMyPhone(phone);
    if (!p.ok) return setError('login.invalidPhone');
    setBusy(true);
    try {
      const r = await call<object, { visitNumber: number; checkedIn: boolean }>('submitVisitorForm', {
        name: name.trim(), phone: p.e164, familyNames: family.map((f) => f.trim()).filter(Boolean),
        howHeard: how || undefined, contactConsent: contact, pdpaConsent: true,
      });
      setDone(r);
    } catch (err) {
      setError((err as { message?: string })?.message === 'welcome.tooMany' ? 'welcome.tooMany' : 'common.error');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card center">
        <h1>{t('welcome.thanks')}</h1>
        <p className="qrname">{t('welcome.visitN', { n: done.visitNumber })}</p>
        {done.checkedIn && <p className="ok">{t('scan.ok')}</p>}
        <p className="muted">{t('welcome.nextTime')}</p>
        <Link className="btn block" to="/login">{t('welcome.goLogin')}</Link>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h1>{t('welcome.title')}</h1>
      <p className="muted">{t('welcome.intro')}</p>
      <label htmlFor="w-name">{t('welcome.name')}</label>
      <input id="w-name" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      <label htmlFor="w-phone">{t('welcome.phone')}</label>
      <input id="w-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="012-345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} />

      <label>{t('welcome.family')}</label>
      {family.map((f, i) => (
        <input key={i} style={{ marginBottom: 6 }} aria-label={t('welcome.familyName', { n: i + 1 })} value={f} maxLength={80}
          onChange={(e) => setFamily((fs) => fs.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      {family.length < 10 && (
        <button type="button" className="btn" onClick={() => setFamily((fs) => [...fs, ''])}>+ {t('welcome.addFamily')}</button>
      )}

      <label htmlFor="w-how">{t('welcome.how')}</label>
      <select id="w-how" value={how} onChange={(e) => setHow(e.target.value)}>
        <option value="">—</option>
        {HOW.map((k) => <option key={k} value={k.split('.').pop()}>{t(k)}</option>)}
      </select>

      <label className="check" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} />
        {t('welcome.contact')}
      </label>

      <div className="pdpa">
        <p>{t('welcome.pdpaText')}</p>
        <label className="check">
          <input type="checkbox" checked={pdpa} onChange={(e) => setPdpa(e.target.checked)} />
          {t('welcome.pdpaAgree')}
        </label>
      </div>

      {error && <p className="err" role="alert">{t(error)}</p>}
      <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy || !pdpa || !name.trim() || !phone.trim()}>
        {t('welcome.submit')}
      </button>
    </form>
  );
}
