import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { addFamilyMember, updateFamilyMember, useHousehold } from '../api';
import { useT, type MessageKey } from '../i18n';
import QrCard from './QrCard';
import type { Person, PersonKind } from '../../shared/types';

/** Inline editor for one family member. Removal asks inside the app: browser confirm() can be suppressed in installed PWAs. */
function MemberEditor({ p, isSelf, onDone }: { p: Person; isSelf: boolean; onDone: () => void }) {
  const { t } = useT();
  const [name, setName] = useState(p.name);
  const [kind, setKind] = useState<PersonKind>(p.kind);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function run(patch: Parameters<typeof updateFamilyMember>[1]) {
    setBusy(true);
    setError(null);
    try {
      await updateFamilyMember(p.id, patch);
      onDone();
    } catch {
      setError('common.error');
      setBusy(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('family.nameRequired');
    run({ name: name.trim(), kind });
  }

  return (
    <form className="card" onSubmit={save} noValidate>
      <label htmlFor="edit-name">{t('family.editName')}</label>
      <input id="edit-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
        <label className="check"><input id="edit-adult" type="radio" name="edit-kind" checked={kind === 'adult'} onChange={() => setKind('adult')} />{t('family.adult')}</label>
        <label className="check"><input id="edit-child" type="radio" name="edit-kind" checked={kind === 'child'} onChange={() => setKind('child')} />{t('family.child')}</label>
      </div>
      {error && <p className="err" role="alert">{t(error)}</p>}
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={busy}>{t('family.save')}</button>
        <button type="button" className="btn" onClick={onDone}>{t('common.cancel')}</button>
      </div>
      {!isSelf && (asking ? (
        <div style={{ marginTop: 12 }}>
          <p className="warn">{t('family.removeConfirm', { name: p.name })}</p>
          <p className="muted small">{t('family.removeHint')}</p>
          <div className="grid2">
            <button type="button" className="btn" style={{ color: 'var(--err)' }} disabled={busy} onClick={() => run({ active: false })}>{t('family.removeYes')}</button>
            <button type="button" className="btn" onClick={() => setAsking(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn block" style={{ marginTop: 12, color: 'var(--err)' }} onClick={() => setAsking(true)}>{t('family.remove')}</button>
      ))}
    </form>
  );
}

export default function FamilyPage() {
  const { t } = useT();
  const { user, person } = useAuth();
  const family = useHousehold(user?.householdId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PersonKind | ''>('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

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
              {p.name}{p.id === person?.id && <span className="muted"> {t('family.you')}</span>} <span className="muted">· {t(p.kind === 'child' ? 'family.child' : 'family.adult')}</span>
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => setShowQr(showQr === p.id ? null : p.id)}>{t('family.showQr')}</button>
              <button className="btn" aria-label={`${t('family.edit')} ${p.name}`} onClick={() => setEditing(editing === p.id ? null : p.id)}>{t('family.edit')}</button>
            </span>
          </li>
        ))}
      </ul>
      {editing && family?.find((p) => p.id === editing) && (
        <MemberEditor key={editing} p={family.find((p) => p.id === editing)!} isSelf={editing === person?.id} onDone={() => setEditing(null)} />
      )}
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
