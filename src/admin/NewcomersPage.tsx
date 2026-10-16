import { usePeople } from '../api';
import { useT } from '../i18n';
import { daysBetween, klDate } from '../../shared/dates';
import type { Person } from '../../shared/types';

export interface NewcomerRow { person: Person; daysSince: number | null }

export function newcomerRows(people: Person[], today: string): NewcomerRow[] {
  return people
    .filter((p) => p.active && p.status === 'visitor')
    .map((p) => ({ person: p, daysSince: p.lastVisitDate ? daysBetween(p.lastVisitDate, today) : null }))
    .sort((a, b) => (b.person.lastVisitDate ?? '').localeCompare(a.person.lastVisitDate ?? ''));
}

export default function NewcomersPage() {
  const { t } = useT();
  const people = usePeople();
  const rows = newcomerRows(people ?? [], klDate(new Date()));
  return (
    <div>
      <h1>{t('home.newcomers')}</h1>
      <div className="card scroll-x">
        {people === undefined ? <p className="muted">{t('common.loading')}</p> : rows.length === 0 ? <p className="muted">{t('newcomers.none')}</p> : (
          <table>
            <thead>
              <tr><th>{t('profile.name')}</th><th>{t('login.phone')}</th><th>{t('newcomers.visits')}</th><th>{t('mydata.firstVisit')}</th><th>{t('newcomers.last')}</th><th>{t('newcomers.daysSince')}</th><th>{t('mydata.contact')}</th></tr>
            </thead>
            <tbody>
              {rows.map(({ person: p, daysSince }) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : '—'}</td>
                  <td>{p.visitCount}</td>
                  <td>{p.firstVisitDate ?? '—'}</td>
                  <td>{p.lastVisitDate ?? '—'}</td>
                  <td className={daysSince !== null && daysSince > 21 ? 'warn' : ''}>{daysSince ?? '—'}</td>
                  <td>{p.contactConsent ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
