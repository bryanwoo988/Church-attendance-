import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useAttendanceForMeetings, useGroupMeetings, useGroups, usePeople } from '../api';
import { useT } from '../i18n';
import { klDate } from '../../shared/dates';
import { groupAttendanceTable } from '../../shared/stats';

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);

export default function GroupAttendancePage() {
  const { t } = useT();
  const { uid, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const groups = (useGroups() ?? []).filter((g) => isAdmin || (uid && g.leaderUids.includes(uid)));
  const people = usePeople() ?? [];
  const today = klDate(new Date());
  const [from, setFrom] = useState(klDate(new Date(Date.now() - 90 * 86_400_000)));
  const [to, setTo] = useState(today);
  const [chosen, setChosen] = useState('');
  const group = groups.find((g) => g.id === chosen) ?? groups[0];
  const meetings = useGroupMeetings(group?.id, from, to);
  const ids = useMemo(() => (meetings ?? []).map((m) => m.id).sort(), [meetings]);
  const attendance = useAttendanceForMeetings(ids);
  const table = group && meetings && attendance ? groupAttendanceTable(group, people, meetings, attendance) : null;

  if (groups.length === 0) return <p className="card">{t('groupAtt.noGroups')}</p>;

  return (
    <div>
      <h1>{t('groupAtt.title')}</h1>
      <label htmlFor="ga-group">{t('meeting.group')}</label>
      <select id="ga-group" value={group?.id ?? ''} onChange={(e) => setChosen(e.target.value)}>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <div className="grid2">
        <div><label htmlFor="ga-from">{t('export.from')}</label><input id="ga-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label htmlFor="ga-to">{t('export.to')}</label><input id="ga-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="card scroll-x" style={{ marginTop: 12 }}>
        {!table ? (
          <p className="muted">{t('common.loading')}</p>
        ) : table.rows.length === 0 ? (
          <p className="muted">{t('groupAtt.noMembers')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('profile.name')}</th>
                {table.meetings.map((m) => <th key={m.id}>{m.date.slice(5)}</th>)}
                <th>{t('groupAtt.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.personId}>
                  <td>{r.name}</td>
                  {r.marks.map((m, i) => <td key={i} className={m ? 'ok' : 'muted'}>{m === null ? '' : m ? '✓' : '·'}</td>)}
                  <td>{pct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {table && table.meetings.length === 0 && <p className="muted">{t('groupAtt.noMeetings')}</p>}
      </div>
    </div>
  );
}
