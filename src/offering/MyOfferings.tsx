import { useState } from 'react';
import { deleteOwnOffering, updateOwnOffering } from '../api';
import { confirmSheet } from '../ui/confirm';
import { toast } from '../ui/toast';
import { useT, type MessageKey } from '../i18n';
import { formatSen, parseAmountToSen } from '../../shared/money';
import type { Offering } from '../../shared/types';

const EDIT_WINDOW_MS = 24 * 3600_000;

export default function MyOfferings({ offerings, categories }: { offerings: Offering[]; categories: string[] }) {
  const { t } = useT();
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);

  if (offerings.length === 0) return <p className="muted">{t('offering.none')}</p>;
  const editable = (o: Offering) => Date.now() - o.createdAt.getTime() < EDIT_WINDOW_MS;

  async function save(o: Offering) {
    const p = parseAmountToSen(amount);
    if (!p.ok) return setError(p.error === 'zero' ? 'offering.zero' : p.error === 'tooLarge' ? 'offering.tooLarge' : 'offering.invalid');
    try {
      await updateOwnOffering(o.id, p.sen, category || o.category);
      setEditing(null);
    } catch {
      setError('offering.editExpired');
    }
  }

  return (
    <ul className="list">
      {offerings.map((o) => (
        <li key={o.id} style={{ flexWrap: 'wrap' }}>
          {editing === o.id ? (
            <div style={{ width: '100%' }}>
              <input aria-label={t('offering.amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select value={category || o.category} onChange={(e) => setCategory(e.target.value)} style={{ marginTop: 6 }}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
              {error && <p className="err">{t(error)}</p>}
              <div className="grid2" style={{ marginTop: 6 }}>
                <button className="btn primary" onClick={() => save(o)}>{t('common.save')}</button>
                <button className="btn" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <>
              <span>{o.date}<br /><span className="muted">{o.category}</span></span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <strong>{formatSen(o.amountSen)}</strong>
                {editable(o) && (
                  <>
                    <button className="btn" onClick={() => { setEditing(o.id); setAmount((o.amountSen / 100).toFixed(2)); setCategory(o.category); setError(null); }}>
                      {t('offering.edit')}
                    </button>
                    <button className="btn" onClick={async () => {
                      if (!(await confirmSheet({ title: t('offering.deleteConfirm'), confirmLabel: t('offering.delete'), danger: true }))) return;
                      try {
                        await deleteOwnOffering(o.id);
                      } catch {
                        toast({ kind: 'err', title: t('ui.errorTitle'), body: t('ui.errorBody') });
                      }
                    }}>{t('offering.delete')}</button>
                  </>
                )}
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
