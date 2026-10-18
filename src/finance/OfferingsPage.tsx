import { useMemo, useState } from 'react';
import { usePeople, useOfferingsBetween, useSettings } from '../api';
import { call } from '../firebase';
import { confirmSheet } from '../ui/confirm';
import { useT, type MessageKey } from '../i18n';
import { klDate } from '../../shared/dates';
import { formatSen, parseAmountToSen } from '../../shared/money';

export default function OfferingsPage() {
  const { t } = useT();
  const today = klDate(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const offerings = useOfferingsBetween(from, to);
  const people = usePeople() ?? [];
  const categories = useSettings()?.offeringCategories ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [err, setErr] = useState<MessageKey | null>(null);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '（已删除）';
  const total = useMemo(() => (offerings ?? []).reduce((s, o) => s + o.amountSen, 0), [offerings]);

  async function save(id: string) {
    setErr(null);
    const p = parseAmountToSen(amount);
    if (!p.ok) return setErr(p.error === 'zero' ? 'offering.zero' : p.error === 'tooLarge' ? 'offering.tooLarge' : 'offering.invalid');
    try {
      await call('financeEditOffering', { offeringId: id, amountSen: p.sen, category });
      setEditing(null);
    } catch {
      setErr('common.error');
    }
  }

  async function remove(id: string) {
    if (!(await confirmSheet({ title: t('offering.deleteConfirm'), confirmLabel: t('offering.delete'), danger: true }))) return;
    try {
      await call('financeEditOffering', { offeringId: id, delete: true });
    } catch {
      setErr('common.error');
    }
  }

  return (
    <div>
      <h1>{t('home.finance')}</h1>
      <div className="grid2">
        <div><label htmlFor="fo-from">{t('export.from')}</label><input id="fo-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label htmlFor="fo-to">{t('export.to')}</label><input id="fo-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <p className="qrname">{t('finance.total', { amount: formatSen(total), n: offerings?.length ?? 0 })}</p>
      <p className="muted">{t('finance.reconcile')}</p>
      {err && <p className="err">{t(err)}</p>}
      <ul className="list card">
        {offerings === undefined && <li className="muted">{t('common.loading')}</li>}
        {(offerings ?? []).map((o) => (
          <li key={o.id} style={{ flexWrap: 'wrap' }}>
            {editing === o.id ? (
              <div style={{ width: '100%' }}>
                <input aria-label={t('offering.amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginTop: 6 }}>
                  {[...new Set([o.category, ...categories])].map((c) => <option key={c}>{c}</option>)}
                </select>
                <div className="grid2" style={{ marginTop: 6 }}>
                  <button className="btn primary" onClick={() => save(o.id)}>{t('common.save')}</button>
                  <button className="btn" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <>
                <span>{o.date} · {nameOf(o.personId)}<br /><span className="muted">{o.category}</span></span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <strong>{formatSen(o.amountSen)}</strong>
                  <button className="btn" onClick={() => { setEditing(o.id); setAmount((o.amountSen / 100).toFixed(2)); setCategory(o.category); }}>{t('offering.edit')}</button>
                  <button className="btn" onClick={() => remove(o.id)}>{t('offering.delete')}</button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
