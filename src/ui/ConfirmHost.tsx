import { useEffect } from 'react';
import { useT } from '../i18n';
import { answer, usePendingConfirm } from './confirm';

export default function ConfirmHost() {
  const { t } = useT();
  const p = usePendingConfirm();
  useEffect(() => {
    if (!p) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);
  if (!p) return null;
  return (
    <div className="sheet-backdrop" onClick={() => answer(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden />
        <h2 className="sheet-title">{p.title}</h2>
        {p.body && <p className="muted">{p.body}</p>}
        <div className="stack">
          <button className={'btn block ' + (p.danger ? 'danger' : 'primary')} onClick={() => answer(true)}>{p.confirmLabel ?? t('common.confirm')}</button>
          <button className="btn block" onClick={() => answer(false)}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
