import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { useT } from '../i18n';
import ProfileSetup from './ProfileSetup';
import type { Role } from '../../shared/types';

export function RequireAuth({ children }: { children: ReactNode }) {
  const a = useAuth();
  const { t } = useT();
  const loc = useLocation();
  if (a.status === 'signedOut') {
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  }
  if (a.status === 'needsName') return <ProfileSetup />;
  if (a.status === 'error') {
    return (
      <div className="card">
        <p className="err">{t('common.error')}</p>
        <button className="btn" onClick={a.refresh}>{t('common.retry')}</button>
      </div>
    );
  }
  if (a.status !== 'ready') return <p className="muted">{t('common.loading')}</p>;
  return <>{children}</>;
}

export function RequireRole({ any, children }: { any: Role[]; children: ReactNode }) {
  const a = useAuth();
  const { t } = useT();
  return (
    <RequireAuth>
      {a.roles.some((r) => any.includes(r)) ? children : <p className="card">{t('common.noPermission')}</p>}
    </RequireAuth>
  );
}
