import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useGroups, useHousehold, useHouseholdAttendance, useMeetingsByIds } from '../api';
import { call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { klTime } from '../../shared/dates';
import type { Group, Meeting } from '../../shared/types';
import ChangePhone from './ChangePhone';

/** e.g. "主日 · 2026-10-18", "小组 · 青年小组 · 周五查经", "活动 · 圣诞晚会". */
function meetingLabel(t: (k: MessageKey) => string, m: Meeting | undefined, groups: Group[], date: string): string {
  if (!m) return date;
  if (m.type === 'sunday') return `${t('rec.sunday')} · ${m.date}`;
  if (m.type === 'event') return `${t('rec.event')} · ${m.title}`;
  const group = groups.find((g) => g.id === m.groupId)?.name;
  return [t('rec.group'), group, group !== m.title ? m.title : undefined].filter(Boolean).join(' · ');
}

export default function MyDataPage() {
  const { t } = useT();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const family = useHousehold(user?.householdId) ?? [];
  const attendance = useHouseholdAttendance(family.map((p) => p.id)) ?? [];
  const meetings = useMeetingsByIds(attendance.map((a) => a.meetingId)) ?? [];
  const groups = useGroups() ?? [];
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const nameOf = (id: string) => family.find((p) => p.id === id)?.name ?? '';

  async function del() {
    setBusy(true);
    setErr(false);
    try {
      await call('deleteMyData', { confirm: 'DELETE' });
      await signOut();
      nav('/', { replace: true });
    } catch {
      setErr(true);
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{t('mydata.title')}</h1>
      <h2>{t('mydata.records')}</h2>
      <div className="card">
        {attendance.length === 0 ? <p className="muted">{t('mydata.noRecords')}</p> : (
          <ul className="list">
            {attendance.map((a) => (
              <li key={a.meetingId + a.personId}>
                <div>
                  <div>{meetingLabel(t, meetings.find((m) => m.id === a.meetingId), groups, a.date)}</div>
                  <div className="muted small">{nameOf(a.personId)} · {t(`method.${a.method}` as MessageKey)}</div>
                </div>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{`${a.date} ${klTime(a.at)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <h2>{t('mydata.stored')}</h2>
      <p className="muted">{t('mydata.storedHint')}</p>
      {family.map((p) => (
        <div className="card" key={p.id}>
          <table><tbody>
            <tr><th>{t('profile.name')}</th><td>{p.name}</td></tr>
            {p.phone && <tr><th>{t('login.phone')}</th><td>{p.phone}</td></tr>}
            <tr><th>{t('mydata.kind')}</th><td>{t(p.kind === 'child' ? 'family.child' : 'family.adult')}</td></tr>
            {p.firstVisitDate && <tr><th>{t('mydata.firstVisit')}</th><td>{p.firstVisitDate}</td></tr>}
            {p.howHeard && <tr><th>{t('mydata.howHeard')}</th><td>{p.howHeard}</td></tr>}
            {p.contactConsent !== undefined && <tr><th>{t('mydata.contact')}</th><td>{p.contactConsent ? '✓' : '✗'}</td></tr>}
          </tbody></table>
        </div>
      ))}
      <div className="card">
        <h2>{t('phone.title')}</h2>
        <p className="muted">{t('phone.hint')}</p>
        <ChangePhone current={family.find((p) => p.id === user?.personId)?.phone} />
      </div>
      <div className="card">
        <h2 className="err">{t('mydata.deleteTitle')}</h2>
        <p>{t('mydata.deleteHint')}</p>
        <label htmlFor="typed">{t('mydata.typeDelete')}</label>
        <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
        {err && <p className="err">{t('common.error')}</p>}
        <button className="btn block" style={{ marginTop: 12, color: 'var(--err)' }} disabled={typed !== 'DELETE' || busy} onClick={del}>
          {t('mydata.delete')}
        </button>
      </div>
    </div>
  );
}
