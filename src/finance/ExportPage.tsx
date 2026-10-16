import { useState } from 'react';
import { fetchExportData } from '../api';
import { useT, type MessageKey } from '../i18n';
import { klDate } from '../../shared/dates';
import { buildExportSheets } from '../../shared/export';
import { downloadXlsx } from './writeXlsx';

export default function ExportPage() {
  const { t } = useT();
  const today = klDate(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; key: MessageKey } | null>(null);

  async function run() {
    setMsg(null);
    if (from > to) return setMsg({ kind: 'err', key: 'export.badRange' });
    setBusy(true);
    try {
      const data = await fetchExportData(from, to);
      await downloadXlsx(buildExportSheets({ ...data, from, to }), `church-${from}_${to}.xlsx`);
      setMsg({ kind: 'ok', key: 'export.done' });
    } catch {
      setMsg({ kind: 'err', key: 'common.error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{t('home.export')}</h1>
      <div className="card">
        <div className="grid2">
          <div><label htmlFor="ex-from">{t('export.from')}</label><input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label htmlFor="ex-to">{t('export.to')}</label><input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <p className="muted">{t('export.hint')}</p>
        {msg && <p className={msg.kind} role="status">{t(msg.key)}</p>}
        <button className="btn primary block" disabled={busy} onClick={run}>{busy ? t('common.loading') : t('export.download')}</button>
      </div>
    </div>
  );
}
