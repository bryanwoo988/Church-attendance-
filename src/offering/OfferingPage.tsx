import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { addOffering, useMyOfferings, useSettings } from '../api';
import { useT, type MessageKey } from '../i18n';
import { formatSen, parseAmountToSen } from '../../shared/money';
import { klDate } from '../../shared/dates';
import MyOfferings from './MyOfferings';
import { settleWithin } from '../util/settle';

export default function OfferingPage() {
  const { t } = useT();
  const { user } = useAuth();
  const settings = useSettings();
  const mine = useMyOfferings(user?.uid) ?? [];
  const categories = settings?.offeringCategories?.length ? settings.offeringCategories : ['一般奉献 General'];
  const [step, setStep] = useState<'qr' | 'amount' | 'done'>('qr');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedSen, setSavedSen] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const p = parseAmountToSen(amount);
    if (!p.ok) return setError(p.error === 'zero' ? 'offering.zero' : p.error === 'tooLarge' ? 'offering.tooLarge' : 'offering.invalid');
    if (!user) return;
    setBusy(true);
    try {
      const write = addOffering({ uid: user.uid, personId: user.personId, householdId: user.householdId, amountSen: p.sen, category: category || categories[0], date: klDate(new Date()) });
      // Saved locally even when offline; Firestore syncs it later. Don't leave the button spinning (a retry would duplicate it).
      if ((await settleWithin(write)) === 'pending') write.catch(() => {});
      setSavedSen(p.sen);
      setAmount('');
      setStep('done');
    } catch {
      setError('common.error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{t('home.offering')}</h1>
      {step === 'qr' && (
        <div className="card center">
          {settings?.paymentQrDataUrl ? (
            <>
              <img src={settings.paymentQrDataUrl} alt={t('offering.qrAlt')} className="payqr" />
              <p className="muted">{t('offering.qrHint')}</p>
            </>
          ) : (
            <p className="warn">{t('offering.noQr')}</p>
          )}
          <button className="btn primary block" onClick={() => setStep('amount')}>{t('offering.paid')}</button>
        </div>
      )}
      {step === 'amount' && (
        <form className="card" onSubmit={submit} noValidate>
          <label htmlFor="amt">{t('offering.amount')}</label>
          <input id="amt" inputMode="decimal" placeholder="50.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          {categories.length > 1 && (
            <>
              <label htmlFor="cat">{t('offering.category')}</label>
              <select id="cat" value={category || categories[0]} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </>
          )}
          {error && <p className="err" role="alert">{t(error)}</p>}
          <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy}>{t('offering.submit')}</button>
          <button type="button" className="btn block" style={{ marginTop: 8 }} onClick={() => setStep('qr')}>{t('common.back')}</button>
        </form>
      )}
      {step === 'done' && (
        <div className="card center">
          <p className="ok qrname">{t('offering.saved', { amount: formatSen(savedSen) })}</p>
          <p className="muted">{t('offering.thanks')}</p>
          <button className="btn block" onClick={() => setStep('qr')}>{t('common.back')}</button>
        </div>
      )}
      <h2>{t('offering.mine')}</h2>
      <p className="muted">{t('offering.private')}</p>
      <div className="card"><MyOfferings offerings={mine} categories={categories} /></div>
    </div>
  );
}
