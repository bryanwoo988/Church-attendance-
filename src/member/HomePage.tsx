import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold, useHouseholdDoc, useSettings } from '../api';
import { klDate } from '../../shared/dates';
import { useT } from '../i18n';
import QrCard from './QrCard';
import MyRoles from './MyRoles';

export default function HomePage() {
  const { t } = useT();
  const { user, person, roles, signOut } = useAuth();
  const family = useHousehold(user?.householdId) ?? [];
  const [idx, setIdx] = useState(0);
  const household = useHouseholdDoc(family.length > 1 ? user?.householdId : undefined);
  const withQr = family.filter((p) => !p.noQr && p.id !== person?.id);
  const ordered = person ? [person, ...withQr] : withQr;
  const todayIds = household?.today?.date === klDate(new Date()) ? household.today.personIds : [];
  const todayNames = todayIds.map((id) => family.find((p) => p.id === id)?.name).filter(Boolean).join('、');
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
        {family.length > 1 && <p className="muted small">{t('home.familyHint')}</p>}
        {family.length > 1 && (todayNames
          ? <p className="ok">{t('family.todaySaved', { names: todayNames })} <Link to="/family">{t('family.edit')}</Link></p>
          : <Link className="btn block" to="/family" style={{ marginTop: 8 }}>{t('home.todaySet')}</Link>)}
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
