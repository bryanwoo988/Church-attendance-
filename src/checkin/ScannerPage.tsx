import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { fetchPersonWithFamily, useGroups, useMeetingsOn } from '../api';
import { useT, type MessageKey } from '../i18n';
import { klDate, klTime } from '../../shared/dates';
import { resolveCurrentMeeting } from '../../shared/checkin';
import { todaysAttendees } from '../../shared/family';
import type { Person } from '../../shared/types';
import CameraScanner from './CameraScanner';
import FamilyPicker from './FamilyPicker';
import ManualCheckin from './ManualCheckin';
import { makeScanGate, recordScan, type ScanResult } from './offlineStatus';

type Feedback = { kind: 'ok' | 'warn' | 'err'; msg: MessageKey; names?: string[]; time?: string };

const statusMsg = (res: ScanResult[]): Feedback => {
  if (res.some((r) => r.status === 'queued')) return { kind: 'warn', msg: 'scan.savedOffline' };
  if (!res.every((r) => r.status === 'already')) return { kind: 'ok', msg: 'scan.ok' };
  const at = res.find((r) => r.at)?.at;
  return at ? { kind: 'warn', msg: 'scan.alreadyAt', time: klTime(at) } : { kind: 'warn', msg: 'scan.already' };
};

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
  const [pickerInitial, setPickerInitial] = useState<string[] | undefined>();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
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
      show({ ...statusMsg(res), names });
    } catch {
      show({ kind: 'err', msg: 'common.error' });
    } finally {
      setBusy(false);
      setPicker(null);
      setManual(false);
    }
  }

  /** Look someone up and check them in; with family on the account, let the scanner tick who came (all ticked). */
  async function checkInPerson(personId: string, fallbackName: string) {
    let found: Awaited<ReturnType<typeof fetchPersonWithFamily>> = null;
    try {
      found = await fetchPersonWithFamily(personId);
    } catch {
      // offline and not cached: still record the scanned person
      return record([personId], [fallbackName]);
    }
    if (!found) return show({ kind: 'err', msg: 'scan.unknownPerson' });
    const { person, family } = found;
    // The family may have said who is coming today: those start ticked, the scanner confirms.
    const listed = todaysAttendees(found.today, klDate(new Date()), family.map((p) => p.id), person.id);
    if (listed || family.length > 1) {
      const first = listed ?? [person.id];
      setManual(false);
      setPickerInitial(listed ?? undefined);
      setPicker([...first.map((id) => family.find((p) => p.id === id)!), ...family.filter((p) => !first.includes(p.id))]);
      return;
    }
    return record([person.id], [person.name]);
  }

  async function onDecode(text: string) {
    if (busy || picker || manual) return;
    const g = gate.current(text, Date.now());
    if (g === 'ignore') return;
    if (g === 'notChurch') return show({ kind: 'err', msg: 'scan.notChurchQr' });
    return checkInPerson(g.personId, t('scan.unknownName'));
  }

  if (meetings && allowed.length === 0) {
    return (
      <div className="card">
        <p>{t('scan.noMeeting')}</p>
        <p className="muted">{t('scan.noMeetingWhy')}</p>
        {(roles.includes('admin') || roles.includes('leader')) && <Link className="btn primary block" to="/admin/meetings">{t('scan.openMeeting')}</Link>}
      </div>
    );
  }

  return (
    <div>
      <h1>{t('home.scan')}</h1>
      {allowed.length > 1 && (
        <select value={meeting?.id ?? ''} onChange={(e) => setChosen(e.target.value)} aria-label={t('scan.meeting')}>
          {allowed.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      )}
      {meeting && <p className="muted">{t('scan.recordingFor', { title: meeting.title })}</p>}
      {meeting && (
        <div className="chips" style={{ justifyContent: 'flex-start', marginBottom: 12 }}>
          <button className={'chip' + (manual ? '' : ' on')} onClick={() => setManual(false)}>{t('scan.tabScan')}</button>
          <button className={'chip' + (manual ? ' on' : '')} onClick={() => { setPicker(null); setManual(true); }}>{t('scan.tabManual')}</button>
        </div>
      )}
      {feedback && (
        <div className={`card feedback ${feedback.kind}`} role="status">
          {feedback.names?.map((n) => <div key={n} className="qrname">{n}</div>)}
          <div className={feedback.kind}>{t(feedback.msg, { time: feedback.time ?? '' })}</div>
        </div>
      )}
      {picker && (
        <div className="card">
          <FamilyPicker key={picker.map((p) => p.id).join()} people={picker} initial={pickerInitial} busy={busy} onConfirm={(ids) => record(ids, picker.filter((p) => ids.includes(p.id)).map((p) => p.name))} />
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => setPicker(null)}>{t('common.cancel')}</button>
        </div>
      )}
      {meeting && manual ? (
        <ManualCheckin
          meetingId={meeting.id}
          onPick={(id, name) => checkInPerson(id, name)}
          onAdded={(name, status) => { setManual(false); show({ ...statusMsg([{ personId: '', status }]), names: [name] }); }}
          onClose={() => setManual(false)}
        />
      ) : (
        <CameraScanner onDecode={onDecode} paused={!!picker} />
      )}
    </div>
  );
}
