import { useEffect, useState, type ChangeEvent } from 'react';
import { saveSettings, useSettings } from '../api';
import { useT, type MessageKey } from '../i18n';
import type { CheckinMode } from '../../shared/types';

const MAX_RAW = 5 * 1024 * 1024;
const MAX_DATA_URL = 900_000;

/** Downscale to at most `maxPx` on the long side and return a PNG data URL (QR codes stay crisp in PNG). */
async function imageToDataUrl(file: File, maxPx = 900): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

const WEEKDAYS: MessageKey[] = ['wd.0', 'wd.1', 'wd.2', 'wd.3', 'wd.4', 'wd.5', 'wd.6'];

export default function SettingsPage() {
  const { t } = useT();
  const settings = useSettings();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: MessageKey } | null>(null);
  const [weekday, setWeekday] = useState(0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:30');
  const [mode, setMode] = useState<CheckinMode>('window');
  const [cats, setCats] = useState('');

  useEffect(() => {
    if (!settings) return;
    setWeekday(settings.sunday.weekday);
    setStart(settings.sunday.start);
    setEnd(settings.sunday.end);
    setMode(settings.sunday.checkinMode);
    setCats(settings.offeringCategories.join('\n'));
  }, [settings]);

  async function run(fn: () => Promise<void>) {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'ok', key: 'common.saved' });
    } catch {
      setMsg({ kind: 'err', key: 'common.error' });
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    setMsg(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setMsg({ kind: 'err', key: 'settings.notImage' });
    if (f.size > MAX_RAW) return setMsg({ kind: 'err', key: 'settings.fileTooLarge' });
    let url: string;
    try {
      url = await imageToDataUrl(f);
    } catch {
      return setMsg({ kind: 'err', key: 'settings.notImage' });
    }
    if (url.length > MAX_DATA_URL) return setMsg({ kind: 'err', key: 'settings.fileTooLarge' });
    await run(() => saveSettings({ paymentQrDataUrl: url }));
  }

  return (
    <div>
      <h1>{t('home.settings')}</h1>
      {msg && <p className={`card ${msg.kind}`} role="status">{t(msg.key)}</p>}
      <div className="card">
        <h2>{t('settings.qrTitle')}</h2>
        {settings?.paymentQrDataUrl && <img className="payqr" src={settings.paymentQrDataUrl} alt={t('offering.qrAlt')} />}
        <label htmlFor="qr-file">{t('settings.qrUpload')}</label>
        <input id="qr-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
      </div>
      <div className="card">
        <h2>{t('settings.sundayTitle')}</h2>
        <label htmlFor="s-wd">{t('settings.weekday')}</label>
        <select id="s-wd" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {WEEKDAYS.map((k, i) => <option key={k} value={i}>{t(k)}</option>)}
        </select>
        <div className="grid2">
          <div><label htmlFor="s-start">{t('settings.sundayStart')}</label><input id="s-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label htmlFor="s-end">{t('settings.sundayEnd')}</label><input id="s-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <label className="check"><input type="radio" name="smode" checked={mode === 'window'} onChange={() => setMode('window')} />{t('meeting.modeWindow')}</label>
        <label className="check"><input type="radio" name="smode" checked={mode === 'always'} onChange={() => setMode('always')} />{t('meeting.modeAlways')}</label>
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => run(() => saveSettings({ sunday: { weekday, start, end, checkinMode: mode } }))}>
          {t('settings.saveSunday')}
        </button>
      </div>
      <div className="card">
        <h2>{t('settings.catTitle')}</h2>
        <label htmlFor="s-cats">{t('settings.catHint')}</label>
        <textarea id="s-cats" rows={4} value={cats} onChange={(e) => setCats(e.target.value)} />
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => run(() => saveSettings({ offeringCategories: cats.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 20) }))}>
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
