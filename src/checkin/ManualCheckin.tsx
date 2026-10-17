import { useMemo, useState, type FormEvent } from 'react';
import { usePeople } from '../api';
import { call } from '../firebase';
import { errorKey } from '../data';
import { useT, type MessageKey } from '../i18n';
import type { PersonKind } from '../../shared/types';

/** Server error codes → messages on this screen. */
const KNOWN: Record<string, MessageKey> = {
  'welcome.nameRequired': 'family.nameRequired',
  'welcome.invalidPhone': 'login.invalidPhone',
  'checkin.noMeeting': 'checkin.noMeeting',
};

/** Door scanner: find someone without their QR code, or add a newcomer, and check them in. */
export default function ManualCheckin({ meetingId, onPick, onAdded, onClose }: {
  meetingId: string;
  onPick: (personId: string, name: string) => void;
  onAdded: (name: string, status: 'ok' | 'already') => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const people = usePeople();
  const [q, setQ] = useState('');
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<PersonKind>('adult');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  const matches = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return [];
    const digits = text.replace(/\D/g, '').replace(/^0/, '');
    return (people ?? [])
      .filter((p) => p.active && (p.name.toLowerCase().includes(text) || (digits.length >= 3 && !!p.phone?.includes(digits))))
      .slice(0, 8);
  }, [people, q]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const name = q.trim();
    try {
      const res = await call<object, { status: 'ok' | 'already' }>('scannerAddVisitor', { meetingId, name, ...(phone.trim() ? { phone: phone.trim() } : {}), kind });
      onAdded(name, res.status);
    } catch (err) {
      setError(KNOWN[errorKey(err) ?? ''] ?? 'common.error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <label htmlFor="m-search">{t('manual.search')}</label>
      <input id="m-search" value={q} maxLength={80} autoFocus onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <ul className="list">
          {matches.map((p) => (
            <li key={p.id}>
              <button className="btn block" disabled={busy} onClick={() => onPick(p.id, p.name)}>
                {p.name} <span className="muted">· {t(`status.${p.status}` as MessageKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && (
        <form onSubmit={add} noValidate style={{ marginTop: 12 }}>
          {matches.length === 0 && <p className="muted">{t('manual.none')}</p>}
          <h2>{t('manual.newTitle')}</h2>
          <p><strong>{q.trim()}</strong></p>
          <label htmlFor="m-phone">{t('manual.phone')}</label>
          <input id="m-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <p className="muted small">{t('manual.phoneHint')}</p>
          <div style={{ display: 'flex', gap: 18 }}>
            <label className="check"><input type="radio" name="m-kind" checked={kind === 'adult'} onChange={() => setKind('adult')} />{t('family.adult')}</label>
            <label className="check"><input type="radio" name="m-kind" checked={kind === 'child'} onChange={() => setKind('child')} />{t('family.child')}</label>
          </div>
          {error && <p className="err" role="alert">{t(error)}</p>}
          <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy}>{t('manual.add')}</button>
        </form>
      )}
      <button className="btn block" style={{ marginTop: 8 }} onClick={onClose}>{t('manual.close')}</button>
    </div>
  );
}
