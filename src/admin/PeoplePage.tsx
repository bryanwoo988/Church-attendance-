import { useMemo, useState, type FormEvent } from 'react';
import { adminCreatePerson, usePeople, useUsers } from '../api';
import { useT, type MessageKey } from '../i18n';
import { normalizeMyPhone } from '../../shared/phone';
import type { PersonStatus } from '../../shared/types';
import PersonEditor from './PersonEditor';

export default function PeoplePage() {
  const { t } = useT();
  const people = usePeople();
  const users = useUsers();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PersonStatus | ''>('');
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [err, setErr] = useState<MessageKey | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, '');
    return (people ?? [])
      .filter((p) => p.active)
      .filter((p) => !status || p.status === status)
      .filter((p) => !s || p.name.toLowerCase().includes(s) || (digits.length >= 3 && (p.phone ?? '').includes(digits)))
      .sort((a, b) => a.householdId.localeCompare(b.householdId) || (a.accountUid ? -1 : 1) || a.name.localeCompare(b.name));
  }, [people, q, status]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!newName.trim()) return;
    let phone: string | undefined;
    if (newPhone.trim()) {
      const p = normalizeMyPhone(newPhone);
      if (!p.ok) return setErr('login.invalidPhone');
      if ((people ?? []).some((x) => x.phone === p.e164 && x.active)) return setErr('person.phoneExists');
      phone = p.e164;
    }
    try {
      const id = await adminCreatePerson({ name: newName.trim(), phone, kind: 'adult', status: 'member' });
      setNewName('');
      setNewPhone('');
      setOpen(id);
    } catch {
      setErr('common.error');
    }
  }

  const openPerson = people?.find((p) => p.id === open);
  if (openPerson) {
    const roles = users?.find((u) => u.uid === openPerson.accountUid)?.roles ?? [];
    return <PersonEditor key={openPerson.id} person={openPerson} roles={roles} people={people ?? []} onClose={() => setOpen(null)} />;
  }

  return (
    <div>
      <h1>{t('home.people')}</h1>
      <div className="grid2">
        <input placeholder={t('people.search')} aria-label={t('people.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as PersonStatus | '')} aria-label={t('person.status')}>
          <option value="">{t('people.allStatus')}</option>
          <option value="visitor">{t('status.visitor')}</option>
          <option value="regular">{t('status.regular')}</option>
          <option value="member">{t('status.member')}</option>
        </select>
      </div>
      <ul className="list card" style={{ marginTop: 12 }}>
        {people === undefined && <li className="muted">{t('common.loading')}</li>}
        {rows.map((p) => (
          <li key={p.id} onClick={() => setOpen(p.id)} style={{ cursor: 'pointer' }}>
            <span>
              {p.accountUid ? '' : '↳ '}{p.name}
              <br /><span className="muted">{t(`status.${p.status}` as MessageKey)}{p.kind === 'child' ? ` · ${t('family.child')}` : ''}{p.phone ? ` · ${p.phone}` : ''}</span>
            </span>
            <span className="muted">›</span>
          </li>
        ))}
      </ul>
      <form className="card" onSubmit={create}>
        <h2>{t('people.createTitle')}</h2>
        <p className="muted">{t('people.createHint')}</p>
        <label htmlFor="np-name">{t('profile.name')}</label>
        <input id="np-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <label htmlFor="np-phone">{t('login.phone')}</label>
        <input id="np-phone" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="012-345 6789" />
        {err && <p className="err">{t(err)}</p>}
        <button className="btn primary block" style={{ marginTop: 12 }}>{t('people.create')}</button>
      </form>
    </div>
  );
}
