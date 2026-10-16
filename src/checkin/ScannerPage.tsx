import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchPersonWithFamily, useGroups, useMeetingsOn } from '../api';
import { useT, type MessageKey } from '../i18n';
import { klDate } from '../../shared/dates';
import { resolveCurrentMeeting } from '../../shared/checkin';
import type { Person } from '../../shared/types';
import CameraScanner from './CameraScanner';
import FamilyPicker from './FamilyPicker';
import { makeScanGate, recordScan, type ScanStatus } from './offlineStatus';

type Feedback = { kind: 'ok' | 'warn' | 'err'; msg: MessageKey; names?: string[] };

const statusMsg = (statuses: ScanStatus[]): Feedback =>
  statuses.includes('queued')
    ? { kind: 'warn', msg: 'scan.savedOffline' }
    : statuses.every((s) => s === 'already')
      ? { kind: 'warn', msg: 'scan.already' }
      : { kind: 'ok', msg: 'scan.ok' };

export default function ScannerPage() {
  const { t } = useT();
  const { uid, roles } = useAuth();
  const today = klDate(new Date());
  const meetings = useMeetingsOn(today);
  const groups = useGroups();
  const isLeaderOnly = roles.includes('leader') && !roles.includes('scanner') && !roles.includes('admin');
  const allowed = useMemo(() => {
    const ms = meetings ?? [];
    if (!isLeaderOnly) return ms;
    const mine = new Set((groups ?? []).filter((g) => uid && g.leaderUids.includes(uid)).map((g) => g.id));
    return ms.filter((m) => m.groupId && mine.has(m.groupId));
  }, [meetings, groups, isLeaderOnly, uid]);
  const [chosen, setChosen] = useState<string>('');
  const meeting = allowed.find((m) => m.id === chosen) ?? resolveCurrentMeeting(allowed, new Date()) ?? allowed[0];

  const gate = useRef(makeScanGate(3000));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [picker, setPicker] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function show(f: Feedback) {
    setFeedback(f);
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setFeedback(null), 2500);
  }

  async function record(ids: string[], names: string[]) {
    if (!meeting || !uid) return;
    setBusy(true);
    try {
      const res = await recordScan(meeting.id, meeting.date, ids, uid);
      show({ ...statusMsg(res.map((r) => r.status)), names });
    } catch {
      show({ kind: 'err', msg: 'common.error' });
    } finally {
      setBusy(false);
      setPicker(null);
    }
  }

  async function onDecode(text: string) {
    if (busy || picker) return;
    const g = gate.current(text, Date.now());
    if (g === 'ignore') return;
    if (g === 'notChurch') return show({ kind: 'err', msg: 'scan.notChurchQr' });
    let found: Awaited<ReturnType<typeof fetchPersonWithFamily>> = null;
    try {
      found = await fetchPersonWithFamily(g.personId);
    } catch {
      // offline and not cached: still record the scanned person
      return record([g.personId], [t('scan.unknownName')]);
    }
    if (!found) return show({ kind: 'err', msg: 'scan.unknownPerson' });
    const { person, family } = found;
    if (person.accountUid && family.length > 1) {
      const ordered = [person, ...family.filter((p) => p.id !== person.id)];
      setPicker(ordered);
      return;
    }
    return record([person.id], [person.name]);
  }

  if (meetings && allowed.length === 0) return <p className="card">{t('scan.noMeeting')}</p>;

  return (
    <div>
      <h1>{t('home.scan')}</h1>
      {allowed.length > 1 && (
        <select value={meeting?.id ?? ''} onChange={(e) => setChosen(e.target.value)} aria-label={t('scan.meeting')}>
          {allowed.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      )}
      {meeting && <p className="muted">{t('scan.recordingFor', { title: meeting.title })}</p>}
      <CameraScanner onDecode={onDecode} paused={!!picker} />
      {feedback && (
        <div className={`card feedback ${feedback.kind}`} role="status">
          {feedback.names?.map((n) => <div key={n} className="qrname">{n}</div>)}
          <div className={feedback.kind}>{t(feedback.msg)}</div>
        </div>
      )}
      {picker && (
        <div className="card">
          <FamilyPicker people={picker} busy={busy} onConfirm={(ids) => record(ids, picker.filter((p) => ids.includes(p.id)).map((p) => p.name))} />
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => setPicker(null)}>{t('common.cancel')}</button>
        </div>
      )}
    </div>
  );
}
