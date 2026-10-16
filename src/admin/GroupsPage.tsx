import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createGroup, updateGroup, useGroups, usePeople } from '../api';
import { useT } from '../i18n';
import type { Group } from '../../shared/types';

export default function GroupsPage() {
  const { t } = useT();
  const { uid, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const groups = (useGroups() ?? []).filter((g) => isAdmin || (uid && g.leaderUids.includes(uid)));
  const people = (usePeople() ?? []).filter((p) => p.active);
  const accounts = people.filter((p) => p.accountUid);
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const g = groups.find((x) => x.id === open);

  const toggle = (grp: Group, field: 'leaderUids' | 'memberPersonIds', id: string) => {
    const cur = grp[field];
    updateGroup(grp.id, { [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };

  if (g) {
    const s = q.trim().toLowerCase();
    return (
      <div>
        <h1>{g.name}</h1>
        {isAdmin && (
          <div className="card">
            <h2>{t('groups.leaders')}</h2>
            {accounts.map((p) => (
              <label key={p.id} className="check"><input type="checkbox" checked={g.leaderUids.includes(p.accountUid!)} onChange={() => toggle(g, 'leaderUids', p.accountUid!)} />{p.name}</label>
            ))}
            <p className="muted">{t('groups.leaderHint')}</p>
          </div>
        )}
        <div className="card">
          <h2>{t('groups.members')} ({g.memberPersonIds.length})</h2>
          <input placeholder={t('people.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          {people.filter((p) => !s || p.name.toLowerCase().includes(s) || g.memberPersonIds.includes(p.id)).map((p) => (
            <label key={p.id} className="check"><input type="checkbox" checked={g.memberPersonIds.includes(p.id)} onChange={() => toggle(g, 'memberPersonIds', p.id)} />{p.name}</label>
          ))}
        </div>
        <button className="btn block" onClick={() => setOpen(null)}>{t('common.back')}</button>
      </div>
    );
  }

  return (
    <div>
      <h1>{t('home.groups')}</h1>
      <ul className="list card">
        {groups.map((x) => (
          <li key={x.id} onClick={() => setOpen(x.id)} style={{ cursor: 'pointer' }}>
            <span>{x.name}</span><span className="muted">{x.memberPersonIds.length} ›</span>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <div className="card">
          <label htmlFor="g-name">{t('groups.newName')}</label>
          <input id="g-name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary block" style={{ marginTop: 10 }} disabled={!name.trim()} onClick={async () => { await createGroup(name.trim()); setName(''); }}>
            {t('groups.create')}
          </button>
        </div>
      )}
    </div>
  );
}
