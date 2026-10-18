import { CircleCheck, CircleAlert, Info, X } from 'lucide-react';
import { useT } from '../i18n';
import { dismiss, useToasts } from './toast';

const ICON = { ok: CircleCheck, err: CircleAlert, info: Info };

export default function Toaster() {
  const { t } = useT();
  const toasts = useToasts();
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((x) => {
        const Icon = ICON[x.kind];
        return (
          <div key={x.id} className={`toast ${x.kind}`} role={x.kind === 'err' ? 'alert' : 'status'}>
            <Icon size={24} aria-hidden className="toast-icon" />
            <div className="toast-text">
              <div className="toast-title">{x.title}</div>
              {x.body && <div className="toast-body">{x.body}</div>}
            </div>
            <button className="icon-btn" aria-label={t('common.close')} onClick={() => dismiss(x.id)}><X size={18} aria-hidden /></button>
          </div>
        );
      })}
    </div>
  );
}
