import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold, useSettings } from '../api';
import { useT } from '../i18n';
import QrCard from './QrCard';
import MyRoles from './MyRoles';

export default function HomePage() {
  const { t } = useT();
  const { user, person, roles, signOut } = useAuth();
  const family = useHousehold(user?.householdId) ?? [];
  const [idx, setIdx] = useState(0);
  const ordered = person ? [person, ...family.filter((p) => p.id !== person.id)] : family;
  const shown = ordered[Math.min(idx, ordered.length - 1)];
  const settings = useSettings();
  const has = (r: string) => roles.includes(r as never);

  return (
    <div>
      <p className="muted">{t('greeting', { name: person?.name ?? '' })}</p>
      <div className="card center">
        {shown ? <QrCard personId={shown.id} name={shown.name} caption={t('home.qrHint')} /> : <p className="muted">{t('common.loading')}</p>}
        {ordered.length > 1 && (
          <div className="chips">
            {ordered.map((p, i) => (
              <button key={p.id} className={'chip' + (shown?.id === p.id ? ' on' : '')} onClick={() => setIdx(i)}>{p.name}</button>
            ))}
          </div>
        )}
        {ordered.length > 1 && <p className="muted small">{t('home.familyHint')}</p>}
      </div>
      <div className="grid2">
        <Link className="btn primary" to="/history">{t('history.title')}</Link>
        {settings?.selfCheckin && <Link className="btn primary" to="/scan-poster">{t('home.checkin')}</Link>}
        <Link className="btn primary" to="/offering">{t('home.offering')}</Link>
        <Link className="btn" to="/family">{t('family.title')}</Link>
        <Link className="btn" to="/me">{t('mydata.title')}</Link>
      </div>
      <MyRoles roles={roles} status={person?.status} />
      {(has('scanner') || has('leader') || has('admin') || has('finance')) && (
        <>
          <h2>{t('home.staff')}</h2>
          <div className="grid2">
            {(has('scanner') || has('leader') || has('admin')) && <Link className="btn" to="/scan">{t('home.scan')}</Link>}
            {(has('leader') || has('admin')) && <Link className="btn" to="/admin/meetings">{t('home.meetings')}</Link>}
            {has('admin') && <Link className="btn" to="/admin/people">{t('home.people')}</Link>}
            {has('admin') && <Link className="btn" to="/admin/newcomers">{t('home.newcomers')}</Link>}
            {(has('admin') || has('leader')) && <Link className="btn" to="/admin/groups">{t('home.groups')}</Link>}
            {(has('admin') || has('leader')) && <Link className="btn" to="/leader/attendance">{t('home.groupAtt')}</Link>}
            {has('admin') && <Link className="btn" to="/admin/posters">{t('home.posters')}</Link>}
            {has('admin') && <Link className="btn" to="/admin/settings">{t('home.settings')}</Link>}
            {(has('finance') || has('admin')) && <Link className="btn" to="/finance/offerings">{t('home.finance')}</Link>}
            {(has('finance') || has('admin')) && <Link className="btn" to="/finance/export">{t('home.export')}</Link>}
          </div>
        </>
      )}
      <button className="btn block" style={{ marginTop: 24 }} onClick={signOut}>{t('home.signOut')}</button>
    </div>
  );
}
