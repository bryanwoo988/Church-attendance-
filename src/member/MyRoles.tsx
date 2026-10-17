import { useT, type MessageKey } from '../i18n';
import type { PersonStatus, Role } from '../../shared/types';

const ORDER: Role[] = ['admin', 'finance', 'leader', 'scanner'];

/** Home-page card: which roles I hold and what each lets me do. */
export default function MyRoles({ roles, status }: { roles: Role[]; status?: PersonStatus }) {
  const { t } = useT();
  const held = ORDER.filter((r) => roles.includes(r));
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('roles.title')}</h2>
      <div className="chips" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
        <span className="chip on">{t('role.member')}</span>
        {held.map((r) => <span key={r} className="chip on">{t(`role.${r}` as MessageKey)}</span>)}
      </div>
      {status && <p className="muted">{t('roles.status')}：<span>{t(`status.${status}` as MessageKey)}</span></p>}
      <details>
        <summary>{t('roles.can')}</summary>
        <ul>
          <li><strong>{t('role.member')}</strong>：<span>{t('roleCan.member')}</span></li>
          {held.map((r) => <li key={r}><strong>{t(`role.${r}` as MessageKey)}</strong>：<span>{t(`roleCan.${r}` as MessageKey)}</span></li>)}
        </ul>
        <p className="muted small">{t('roles.ask')}</p>
      </details>
    </div>
  );
}
