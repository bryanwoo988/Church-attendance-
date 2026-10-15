import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { addFamilyMember, updateFamilyMember, useHousehold } from '../api';
import { useT, type MessageKey } from '../i18n';
import QrCard from './QrCard';
import type { PersonKind } from '../../shared/types';

export default function FamilyPage() {
  const { t } = useT();
  const { user, person } = useAuth();
  const family = useHousehold(user?.householdId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PersonKind | ''>('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('family.nameRequired');
    if (!kind) return setError('family.chooseKind');
    if (!user || !person) return;
    setBusy(true);
    try {
      await addFamilyMember({ householdId: user.householdId, name: name.trim(), kind, status: person.status });
      setName('');
      setKind('');
    } catch {
      setError('common.error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{t('family.title')}</h1>
      <p className="muted">{t('family.hint')}</p>
      <ul className="list card">
        {(family ?? []).map((p) => (
          <li key={p.id}>
            <span>
              {p.name} <span className="muted">· {t(p.kind === 'child' ? 'family.child' : 'family.adult')}</span>
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => setShowQr(showQr === p.id ? null : p.id)}>{t('family.showQr')}</button>
              {p.id !== person?.id && (
                <button className="btn" onClick={() => confirm(t('family.removeConfirm', { name: p.name })) && updateFamilyMember(p.id, { active: false })}>
                  {t('family.remove')}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {showQr && family?.find((p) => p.id === showQr) && (
        <div className="card center">
          <QrCard personId={showQr} name={family.find((p) => p.id === showQr)!.name} />
        </div>
      )}
      <form className="card" onSubmit={add} noValidate>
        <h2>{t('family.addTitle')}</h2>
        <label htmlFor="fname">{t('family.name')}</label>
        <input id="fname" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
          <label className="check"><input type="radio" name="kind" checked={kind === 'adult'} onChange={() => setKind('adult')} />{t('family.adult')}</label>
          <label className="check"><input type="radio" name="kind" checked={kind === 'child'} onChange={() => setKind('child')} />{t('family.child')}</label>
        </div>
        {error && <p className="err" role="alert">{t(error)}</p>}
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy}>{t('family.add')}</button>
      </form>
    </div>
  );
}
