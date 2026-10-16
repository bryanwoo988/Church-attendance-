import { useState, type FormEvent } from 'react';
import { call } from '../firebase';
import { useAuth } from './AuthProvider';
import { useT } from '../i18n';

export default function ProfileSetup() {
  const { t } = useT();
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(false);
    try {
      await call('ensureProfile', { name: name.trim() });
      refresh?.();
    } catch {
      setErr(true);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>{t('profile.welcome')}</h1>
      <p className="muted">{t('profile.nameHint')}</p>
      <label htmlFor="name">{t('profile.name')}</label>
      <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
      {err && <p className="err">{t('common.error')}</p>}
      <button className="btn primary block" style={{ marginTop: 16 }} disabled={busy || !name.trim()}>
        {t('common.continue')}
      </button>
    </form>
  );
}
