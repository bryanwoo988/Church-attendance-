import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold } from '../api';
import { call } from '../firebase';
import { errorKey } from '../data';
import { useT, type MessageKey } from '../i18n';
import FamilyPicker from './FamilyPicker';

interface Res { meetingId: string; meetingTitle: string; results: { personId: string; status: 'ok' | 'already' }[] }

const KNOWN: MessageKey[] = ['checkin.closed', 'checkin.noMeeting', 'checkin.notYourFamily'];

export default function SelfCheckinPage() {
  const { t } = useT();
  const { user, person } = useAuth();
  const [params] = useSearchParams();
  const meetingId = params.get('m') ?? undefined;
  const family = useHousehold(user?.householdId);
  const [result, setResult] = useState<Res | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const autoDone = useRef(false);

  async function submit(personIds: string[]) {
    setBusy(true);
    setError(null);
    try {
      setResult(await call<object, Res>('selfCheckIn', meetingId ? { personIds, meetingId } : { personIds }));
    } catch (e) {
      const k = errorKey(e) as MessageKey | null;
      setError(k && KNOWN.includes(k) ? k : 'common.error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (family && family.length === 1 && !autoDone.current) {
      autoDone.current = true;
      submit([family[0].id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  if (!family) return <p className="muted">{t('common.loading')}</p>;
  const nameOf = (id: string) => family.find((p) => p.id === id)?.name ?? '';
  const ordered = person ? [...family.filter((p) => p.id === person.id), ...family.filter((p) => p.id !== person.id)] : family;

  return (
    <div>
      <h1>{t('home.checkin')}</h1>
      {result ? (
        <div className="card center">
          <p className="muted">{result.meetingTitle}</p>
          {result.results.map((r) => (
            <div key={r.personId} style={{ margin: '8px 0' }}>
              <div className="qrname">{nameOf(r.personId)}</div>
              <div className={r.status === 'ok' ? 'ok' : 'warn'}>{t(r.status === 'ok' ? 'scan.ok' : 'scan.already')}</div>
            </div>
          ))}
          <Link className="btn block" to="/" style={{ marginTop: 12 }}>{t('common.back')}</Link>
        </div>
      ) : error ? (
        <div className="card center">
          <p className="err" role="alert">{t(error)}</p>
          <Link className="btn block" to="/">{t('common.back')}</Link>
        </div>
      ) : family.length > 1 ? (
        <div className="card"><FamilyPicker people={ordered} busy={busy} onConfirm={submit} /></div>
      ) : (
        <p className="muted">{t('common.loading')}</p>
      )}
    </div>
  );
}
