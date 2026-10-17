import { useState } from 'react';
import { useT } from '../i18n';
import type { Person } from '../../shared/types';

/** Tick who came. Everyone starts ticked unless `initial` says who (e.g. the family's list for today). */
export default function FamilyPicker({ people, onConfirm, busy, confirmLabel, initial }: { people: Person[]; onConfirm: (ids: string[]) => void; busy?: boolean; confirmLabel?: string; initial?: string[] }) {
  const { t } = useT();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial ?? people.map((p) => p.id)));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div>
      <p>{t('checkin.whoCame')}</p>
      <ul className="list">
        {people.map((p) => (
          <li key={p.id}>
            <label className="check" style={{ margin: 0, fontSize: '1.1rem' }}>
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 24, height: 24 }} aria-label={p.name} />
              {p.name}
            </label>
            <span className="muted">{t(p.kind === 'child' ? 'family.child' : 'family.adult')}</span>
          </li>
        ))}
      </ul>
      <button className="btn primary block" style={{ marginTop: 12 }} disabled={busy || picked.size === 0} onClick={() => onConfirm(people.filter((p) => picked.has(p.id)).map((p) => p.id))}>
        {confirmLabel ?? t('checkin.confirm', { n: picked.size })}
      </button>
    </div>
  );
}
