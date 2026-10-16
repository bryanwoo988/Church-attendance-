import { useState } from 'react';
import { setRoles, updatePerson } from '../api';
import { call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';
import type { Person, PersonKind, PersonStatus, Role } from '../../shared/types';

const ROLES: Role[] = ['scanner', 'leader', 'finance', 'admin'];
const STATUSES: PersonStatus[] = ['visitor', 'regular', 'member'];

export default function PersonEditor({ person, roles, people, onClose }: { person: Person; roles: Role[]; people: Person[]; onClose: () => void }) {
  const { t } = useT();
  const [name, setName] = useState(person.name);
  const [kind, setKind] = useState<PersonKind>(person.kind);
  const [status, setStatus] = useState<PersonStatus>(person.status);
  const [phone, setPhone] = useState(person.phone ?? '');
  const [current, setCurrent] = useState<Role[]>(roles);
  const [mergeInto, setMergeInto] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: MessageKey } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setMsg(null);
    let phoneE164: string | undefined;
    if (phone.trim()) {
      const p = normalizeMyPhone(phone);
      if (!p.ok) return setMsg({ kind: 'err', key: 'login.invalidPhone' });
      phoneE164 = p.e164;
    }
    setBusy(true);
    try {
      await updatePerson(person.id, { name: name.trim() || person.name, kind, status, ...(phoneE164 && !person.accountUid ? { phone: phoneE164 } : {}) });
      setMsg({ kind: 'ok', key: 'common.saved' });
    } catch {
      setMsg({ kind: 'err', key: 'common.error' });
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(r: Role) {
    if (!person.accountUid) return;
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    setCurrent(next);
    try {
      await setRoles(person.accountUid, next);
    } catch {
      setCurrent(current);
      setMsg({ kind: 'err', key: 'common.error' });
    }
  }

  async function merge() {
    const target = people.find((p) => p.id === mergeInto);
    if (!target) return;
    if (!confirm(t('person.mergeConfirm', { from: person.name, into: target.name }))) return;
    setBusy(true);
    try {
      await call('mergePeople', { fromPersonId: person.id, intoPersonId: target.id });
      onClose();
    } catch {
      setMsg({ kind: 'err', key: 'person.mergeFailed' });
      setBusy(false);
    }
  }

  async function erase() {
    if (!confirm(t('person.deleteConfirm', { name: person.name }))) return;
    setBusy(true);
    try {
      await call('deletePersonData', { personId: person.id });
      onClose();
    } catch {
      setMsg({ kind: 'err', key: 'person.deleteFailed' });
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>{person.name}</h2>
      <label htmlFor="pe-name">{t('profile.name')}</label>
      <input id="pe-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <label htmlFor="pe-phone">{t('login.phone')}</label>
      <input id="pe-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!!person.accountUid} placeholder="012-345 6789" />
      {!person.accountUid && <p className="muted">{t('person.phoneHint')}</p>}
      <label htmlFor="pe-kind">{t('mydata.kind')}</label>
      <select id="pe-kind" value={kind} onChange={(e) => setKind(e.target.value as PersonKind)}>
        <option value="adult">{t('family.adult')}</option>
        <option value="child">{t('family.child')}</option>
      </select>
      <label htmlFor="pe-status">{t('person.status')}</label>
      <select id="pe-status" value={status} onChange={(e) => setStatus(e.target.value as PersonStatus)}>
        {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}` as MessageKey)}</option>)}
      </select>
      {msg && <p className={msg.kind} role="status">{t(msg.key)}</p>}
      <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy} onClick={save}>{t('common.save')}</button>

      <h2>{t('person.roles')}</h2>
      {person.accountUid ? (
        ROLES.map((r) => (
          <label key={r} className="check">
            <input type="checkbox" checked={current.includes(r)} onChange={() => toggleRole(r)} />
            {t(`role.${r}` as MessageKey)}
          </label>
        ))
      ) : (
        <p className="muted">{t('person.noAccount')}</p>
      )}

      <h2>{t('person.mergeTitle')}</h2>
      <p className="muted">{t('person.mergeHint')}</p>
      <label htmlFor="pe-merge">{t('person.mergeInto')}</label>
      <select id="pe-merge" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
        <option value="">—</option>
        {people.filter((p) => p.id !== person.id && p.active).map((p) => (
          <option key={p.id} value={p.id}>{p.name}{p.phone ? ` (${p.phone})` : ''}</option>
        ))}
      </select>
      <button className="btn block" style={{ marginTop: 8 }} disabled={!mergeInto || busy} onClick={merge}>{t('person.merge')}</button>

      {!person.accountUid && (
        <button className="btn block" style={{ marginTop: 16, color: 'var(--err)' }} disabled={busy} onClick={erase}>{t('person.delete')}</button>
      )}
      <button className="btn block" style={{ marginTop: 8 }} onClick={onClose}>{t('common.close')}</button>
    </div>
  );
}
