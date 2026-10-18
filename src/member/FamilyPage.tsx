import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { confirmSheet } from '../ui/confirm';
import { toast } from '../ui/toast';
import { useAuth } from '../auth/AuthProvider';
import { addFamilyMember, saveHousehold, updateFamilyMember, useHousehold, useHouseholdDoc } from '../api';
import { useT, type MessageKey } from '../i18n';
import { klDate } from '../../shared/dates';
import QrCard from './QrCard';
import type { FamilyPreset, Person, PersonKind } from '../../shared/types';

const MAX_PRESETS = 10;

/** Inline editor for one family member. Removal asks inside the app: browser confirm() can be suppressed in installed PWAs. */
function MemberEditor({ p, isSelf, onDone }: { p: Person; isSelf: boolean; onDone: () => void }) {
  const { t } = useT();
  const [name, setName] = useState(p.name);
  const [kind, setKind] = useState<PersonKind>(p.kind);
  const [needQr, setNeedQr] = useState(!p.noQr);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function run(patch: Parameters<typeof updateFamilyMember>[1], done: { title: string; body: string }) {
    setBusy(true);
    setError(null);
    try {
      await updateFamilyMember(p.id, patch);
      toast({ kind: 'ok', ...done });
      onDone();
    } catch {
      setError('common.error');
      setBusy(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('family.nameRequired');
    run({ name: name.trim(), kind, noQr: !needQr }, { title: t('ui.savedTitle'), body: t('family.savedBody', { name: name.trim() }) });
  }

  async function remove() {
    const ok = await confirmSheet({ title: t('family.removeConfirm', { name: p.name }), body: t('family.removeHint'), confirmLabel: t('family.removeYes'), danger: true });
    if (ok) run({ active: false }, { title: t('family.removedTitle'), body: t('family.removedBody', { name: p.name }) });
  }

  return (
    <form className="card" onSubmit={save} noValidate>
      <label htmlFor="edit-name">{t('family.editName')}</label>
      <input id="edit-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
        <label className="check"><input id="edit-adult" type="radio" name="edit-kind" checked={kind === 'adult'} onChange={() => setKind('adult')} />{t('family.adult')}</label>
        <label className="check"><input id="edit-child" type="radio" name="edit-kind" checked={kind === 'child'} onChange={() => setKind('child')} />{t('family.child')}</label>
      </div>
      {!isSelf && (
        <label className="check"><input id="edit-qr" type="checkbox" checked={needQr} onChange={(e) => setNeedQr(e.target.checked)} />{t('family.needQr')}</label>
      )}
      {error && <p className="err" role="alert">{t(error)}</p>}
      <div className="grid2" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={busy}>{busy ? <><LoaderCircle size={20} className="spin" aria-hidden />{t('ui.working')}</> : t('family.save')}</button>
        <button type="button" className="btn" onClick={onDone}>{t('common.cancel')}</button>
      </div>
      {!isSelf && (
        <button type="button" className="btn block" style={{ marginTop: 12, color: 'var(--err)', borderColor: 'var(--err)' }} disabled={busy} onClick={remove}>
          <Trash2 size={18} aria-hidden />{t('family.remove')}
        </button>
      )}
    </form>
  );
}

/** "Who is coming today?" with saved combinations. The door scanner checks in this list from one QR code. */
function TodayCard({ householdId, family }: { householdId: string; family: Person[] }) {
  const { t } = useT();
  const household = useHouseholdDoc(householdId);
  const today = klDate(new Date());
  const ids = family.map((p) => p.id);
  const presets = (household?.presets ?? []).map((pr) => ({ ...pr, personIds: pr.personIds.filter((id) => ids.includes(id)) }));
  const savedToday = household?.today?.date === today ? household.today.personIds.filter((id) => ids.includes(id)) : [];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [presetName, setPresetName] = useState('');
  const [eachQr, setEachQr] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const savedKey = savedToday.join(',');
  const savedQr = household?.today?.qr !== false;

  useEffect(() => {
    if (!savedKey) return;
    setPicked(new Set(savedKey.split(',')));
    setEachQr(savedQr);
  }, [savedKey, savedQr]);

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const pickedIds = family.filter((p) => picked.has(p.id)).map((p) => p.id);
  const names = (list: string[]) => list.map((id) => family.find((p) => p.id === id)?.name).filter(Boolean).join('、');

  async function save(patch: Parameters<typeof saveHousehold>[1], done?: { title: string; body?: string }) {
    setBusy(true);
    setError(null);
    try {
      await saveHousehold(householdId, patch);
      if (done) toast({ kind: 'ok', ...done });
    } catch {
      setError('common.error');
    } finally {
      setBusy(false);
    }
  }

  async function savePreset() {
    const name = presetName.trim();
    if (!name || pickedIds.length === 0) return;
    if (presets.length >= MAX_PRESETS) return setError('family.presetFull');
    const next: FamilyPreset[] = [...presets, { name: name.slice(0, 40), personIds: pickedIds, ...(eachQr ? {} : { qr: false }) }];
    await save({ presets: next }, { title: t('family.presetSavedTitle'), body: `${name} · ${names(pickedIds)}` });
    setPresetName('');
  }

  return (
    <div className="card" role="group" aria-label={t('family.todayTitle')}>
      <h2 style={{ marginTop: 0 }}>{t('family.todayTitle')}</h2>
      <p className="muted small">{t('family.todayHint')}</p>
      {presets.length > 0 && (
        <div className="chips" style={{ justifyContent: 'flex-start' }}>
          {presets.map((pr) => (
            <button key={pr.name} type="button" className="chip" onClick={() => { setPicked(new Set(pr.personIds)); setEachQr(pr.qr !== false); }}>{pr.name}</button>
          ))}
        </div>
      )}
      <ul className="list">
        {family.map((p) => (
          <li key={p.id}>
            <label className="check" style={{ margin: 0, fontSize: '1.05rem' }}>
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 22, height: 22 }} aria-label={p.name} />
              {p.name}
            </label>
          </li>
        ))}
      </ul>
      <label className="check"><input type="checkbox" checked={eachQr} onChange={(e) => setEachQr(e.target.checked)} />{t('family.eachQr')}</label>
      {savedToday.length > 0 && <p className="ok">{t('family.todaySaved', { names: names(savedToday) })}</p>}
      {error && <p className="err" role="alert">{t(error)}</p>}
      <div className="grid2" style={{ marginTop: 10 }}>
        <button type="button" className="btn primary" disabled={busy || pickedIds.length === 0} onClick={() => save({ today: { date: today, personIds: pickedIds, qr: eachQr } }, { title: t('family.todaySavedTitle'), body: t('family.todaySavedBody', { names: names(pickedIds) }) })}>
          {t('family.todaySave')}
        </button>
        {savedToday.length > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => { setPicked(new Set()); save({ today: { date: '', personIds: [] } }); }}>{t('family.todayClear')}</button>
        )}
      </div>
      <h3>{t('family.presets')}</h3>
      {presets.length > 0 && <p className="muted small">{t('family.presetsHint')}</p>}
      {presets.length > 0 && (
        <ul className="list">
          {presets.map((pr, i) => (
            <li key={pr.name}>
              <span>{pr.name} <span className="muted small">· {names(pr.personIds)}{pr.qr === false && ` · ${t('family.oneQrTag')}`}</span></span>
              <button type="button" className="btn" aria-label={`${t('family.presetDelete')} ${pr.name}`} disabled={busy}
                onClick={() => save({ presets: presets.filter((_, j) => j !== i) })}>×</button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="preset-name">{t('family.presetName')}</label>
      <input id="preset-name" value={presetName} maxLength={40} onChange={(e) => setPresetName(e.target.value)} />
      <button type="button" className="btn block" style={{ marginTop: 8 }} disabled={busy || !presetName.trim() || pickedIds.length === 0} onClick={savePreset}>
        {t('family.presetSave')}
      </button>
    </div>
  );
}

export default function FamilyPage() {
  const { t } = useT();
  const { user, person } = useAuth();
  const family = useHousehold(user?.householdId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PersonKind | ''>('');
  const [needQr, setNeedQr] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  function chooseKind(k: PersonKind) {
    setKind(k);
    setNeedQr(k === 'adult'); // babies usually don't carry a QR code; can be changed
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('family.nameRequired');
    if (!kind) return setError('family.chooseKind');
    if (!user || !person) return;
    setBusy(true);
    try {
      await addFamilyMember({ householdId: user.householdId, name: name.trim(), kind, status: person.status, noQr: !needQr });
      toast({ kind: 'ok', title: t('family.addedTitle'), body: t('family.addedBody', { name: name.trim() }) });
      setName('');
      setKind('');
      setNeedQr(true);
    } catch {
      setError('common.error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{t('family.title')}</h1>
      {user && family && family.length > 1 && <TodayCard householdId={user.householdId} family={family} />}
      <h2>{t('family.members')}</h2>
      <p className="muted">{t('family.hint')}</p>
      <ul className="list card">
        {(family ?? []).map((p) => (
          <li key={p.id}>
            <span className="row-main">
              <span className="name">{p.name}</span>
              <span className="muted small">
                {p.id === person?.id && <>{t('family.you')} · </>}{t(p.kind === 'child' ? 'family.child' : 'family.adult')}
                {p.noQr && <> · {t('family.noQrTag')}</>}
              </span>
            </span>
            <span className="row-actions">
              {!p.noQr && <button className="btn sm" onClick={() => setShowQr(showQr === p.id ? null : p.id)}>{t('family.showQr')}</button>}
              <button className="btn sm" aria-label={`${t('family.edit')} ${p.name}`} onClick={() => setEditing(editing === p.id ? null : p.id)}>{t('family.edit')}</button>
            </span>
          </li>
        ))}
      </ul>
      {editing && family?.find((p) => p.id === editing) && (
        <MemberEditor key={editing} p={family.find((p) => p.id === editing)!} isSelf={editing === person?.id} onDone={() => setEditing(null)} />
      )}
      {showQr && family?.find((p) => p.id === showQr) && (
        <div className="card center">
          <QrCard personId={showQr} name={family.find((p) => p.id === showQr)!.name} />
        </div>
      )}
      <form className="card" onSubmit={add} noValidate>
        <h2>{t('family.addTitle')}</h2>
        <label htmlFor="fname">{t('family.name')}</label>
        <input id="fname" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
          <label className="check"><input type="radio" name="kind" checked={kind === 'adult'} onChange={() => chooseKind('adult')} />{t('family.adult')}</label>
          <label className="check"><input type="radio" name="kind" checked={kind === 'child'} onChange={() => chooseKind('child')} />{t('family.child')}</label>
        </div>
        <label className="check"><input type="checkbox" checked={needQr} onChange={(e) => setNeedQr(e.target.checked)} />{t('family.needQr')}</label>
        <p className="muted small">{t('family.noQrHint')}</p>
        {error && <p className="err" role="alert">{t(error)}</p>}
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy}>{t('family.add')}</button>
      </form>
    </div>
  );
}
