import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { createMeeting, useGroups, useMeetingsBetween } from '../api';
import { call } from '../firebase';
import { useT, type MessageKey } from '../i18n';
import { klDate, klDateTime } from '../../shared/dates';
import type { CheckinMode, MeetingType } from '../../shared/types';

export default function MeetingsPage() {
  const { t } = useT();
  const { uid, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const groups = (useGroups() ?? []).filter((g) => isAdmin || (uid && g.leaderUids.includes(uid)));
  const today = klDate(new Date());
  const in60 = klDate(new Date(Date.now() + 60 * 86_400_000));
  const ago30 = klDate(new Date(Date.now() - 30 * 86_400_000));
  const meetings = useMeetingsBetween(ago30, in60) ?? [];

  const [title, setTitle] = useState('');
  const [type, setType] = useState<MeetingType>(isAdmin ? 'event' : 'group');
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<CheckinMode>('always');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: MessageKey } | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveType: MeetingType = isAdmin ? type : 'group';
  const effectiveGroup = effectiveType === 'group' ? groupId || groups[0]?.id || '' : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!title.trim()) return setMsg({ kind: 'err', key: 'meeting.needTitle' });
    if (effectiveType === 'group' && !effectiveGroup) return setMsg({ kind: 'err', key: 'meeting.needGroup' });
    if (mode === 'window' && (!start || !end)) return setMsg({ kind: 'err', key: 'meeting.needTimes' });
    if (mode === 'window' && end <= start) return setMsg({ kind: 'err', key: 'meeting.endAfterStart' });
    setBusy(true);
    try {
      await createMeeting({
        title: title.trim(), type: effectiveType, date, checkinMode: mode, createdBy: uid,
        groupId: effectiveGroup || undefined,
        windowStart: mode === 'window' ? klDateTime(date, start) : undefined,
        windowEnd: mode === 'window' ? klDateTime(date, end) : undefined,
      });
      setTitle('');
      setMsg({ kind: 'ok', key: 'meeting.created' });
    } catch {
      setMsg({ kind: 'err', key: 'common.error' });
    } finally {
      setBusy(false);
    }
  }

  async function sundayNow() {
    try {
      await call('createSundayNow', {});
      setMsg({ kind: 'ok', key: 'meeting.created' });
    } catch {
      setMsg({ kind: 'err', key: 'common.error' });
    }
  }

  const fmtTime = (d?: Date) => d?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

  return (
    <div>
      <h1>{t('home.meetings')}</h1>
      {isAdmin && <button className="btn block" onClick={sundayNow}>{t('meeting.sundayNow')}</button>}
      <form className="card" style={{ marginTop: 12 }} onSubmit={submit} noValidate>
        <h2>{t('meeting.new')}</h2>
        <label htmlFor="mt-title">{t('meeting.title')}</label>
        <input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        {isAdmin && (
          <>
            <label htmlFor="mt-type">{t('meeting.type')}</label>
            <select id="mt-type" value={type} onChange={(e) => setType(e.target.value as MeetingType)}>
              <option value="event">{t('meeting.typeEvent')}</option>
              <option value="group">{t('meeting.typeGroup')}</option>
            </select>
          </>
        )}
        {effectiveType === 'group' && (
          <>
            <label htmlFor="mt-group">{t('meeting.group')}</label>
            <select id="mt-group" value={effectiveGroup} onChange={(e) => setGroupId(e.target.value)}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </>
        )}
        <label htmlFor="mt-date">{t('meeting.date')}</label>
        <input id="mt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label>{t('meeting.mode')}</label>
        <label className="check"><input type="radio" name="mode" checked={mode === 'always'} onChange={() => setMode('always')} />{t('meeting.modeAlways')}</label>
        <label className="check"><input type="radio" name="mode" checked={mode === 'window'} onChange={() => setMode('window')} />{t('meeting.modeWindow')}</label>
        {mode === 'window' && (
          <div className="grid2">
            <div><label htmlFor="mt-start">{t('meeting.start')}</label><input id="mt-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label htmlFor="mt-end">{t('meeting.end')}</label><input id="mt-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
        )}
        {msg && <p className={msg.kind} role="status">{t(msg.key)}</p>}
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy}>{t('meeting.create')}</button>
      </form>
      <h2>{t('meeting.list')}</h2>
      <ul className="list card">
        {meetings.map((m) => (
          <li key={m.id}>
            <span>{m.date} · {m.title}<br /><span className="muted">{m.checkinMode === 'window' ? `${fmtTime(m.windowStart)}–${fmtTime(m.windowEnd)}` : t('meeting.modeAlways')}</span></span>
            {m.type !== 'sunday' && <Link className="btn" to={`/admin/posters?m=${m.id}`}>QR</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
