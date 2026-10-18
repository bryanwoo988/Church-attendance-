import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { useT } from '../i18n';

type State = 'idle' | 'busy' | 'done';

/**
 * A button that shows its own progress: a spinner while working, then a green check for a moment.
 * Errors bubble to the caller (who shows a toast); the button just resets.
 */
export default function AsyncButton({ onClick, children, className = 'btn primary block', doneLabel, disabled, type = 'button', style, id }: {
  onClick: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  doneLabel?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  id?: string;
}) {
  const { t } = useT();
  const [state, setState] = useState<State>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function run() {
    setState('busy');
    try {
      await onClick();
      setState('done');
      timer.current = setTimeout(() => setState('idle'), 1800);
    } catch {
      setState('idle');
    }
  }

  return (
    <button id={id} type={type} className={`${className} ${state === 'done' ? 'is-done' : ''}`} style={style} disabled={disabled || state === 'busy'} onClick={run}>
      {state === 'busy' && <><LoaderCircle size={20} className="spin" aria-hidden />{t('ui.working')}</>}
      {state === 'done' && <><Check size={20} aria-hidden />{doneLabel ?? t('ui.done')}</>}
      {state === 'idle' && children}
    </button>
  );
}
