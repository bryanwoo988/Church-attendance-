import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold, useHouseholdDoc, useSettings } from '../api';
import { klDate } from '../../shared/dates';
import { useT } from '../i18n';
import {
  BarChart3, CalendarDays, ClipboardList, Download, HandCoins, History, LogOut, Printer, ScanLine, ScanQrCode,
  Settings, UserCog, UserPlus, Users, UsersRound, Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import QrCard from './QrCard';
import MyRoles from './MyRoles';

function Tile({ to, icon, label, primary }: { to: string; icon: ReactNode; label: string; primary?: boolean }) {
  return <Link className={'tile' + (primary ? ' primary' : '')} to={to}>{icon}<span>{label}</span></Link>;
}

export default function HomePage() {
  const { t } = useT();
  const { user, person, roles, signOut } = useAuth();
  const family = useHousehold(user?.householdId) ?? [];
  const [idx, setIdx] = useState(0);
  const household = useHouseholdDoc(family.length > 1 ? user?.householdId : undefined);
  const todayList = household?.today?.date === klDate(new Date()) ? household.today : undefined;
  const todayIds = (todayList?.personIds ?? []).filter((id) => family.some((p) => p.id === id));
  const todayNames = todayIds.map((id) => family.find((p) => p.id === id)?.name).join('、');
  // With today's list, only those members' codes; "one family QR" shows just mine (scanning any one brings up the list).
  const familyQr = todayIds.length > 0 && todayList?.qr === false;
  const withQr = family.filter((p) => !p.noQr && p.id !== person?.id && (todayIds.length === 0 || todayIds.includes(p.id)));
  const ordered = person ? [person, ...(familyQr ? [] : withQr)] : withQr;
  const shown = ordered[Math.min(idx, ordered.length - 1)];
  const settings = useSettings();
  const has = (r: string) => roles.includes(r as never);

  return (
    <div>
      <p className="muted">{t('greeting', { name: person?.name ?? '' })}</p>
      <div className="card center">
        {shown ? <QrCard personId={shown.id} name={shown.name} caption={t(familyQr ? 'home.familyQr' : 'home.qrHint')} /> : <p className="muted">{t('common.loading')}</p>}
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
      <div className="tiles">
        <Tile to="/history" icon={<History size={26} aria-hidden />} label={t('history.title')} primary />
        {settings?.selfCheckin && <Tile to="/scan-poster" icon={<ScanQrCode size={26} aria-hidden />} label={t('home.checkin')} primary />}
        <Tile to="/offering" icon={<HandCoins size={26} aria-hidden />} label={t('home.offering')} primary />
        <Tile to="/family" icon={<Users size={26} aria-hidden />} label={t('family.title')} />
        <Tile to="/me" icon={<UserCog size={26} aria-hidden />} label={t('mydata.title')} />
      </div>
      <MyRoles roles={roles} status={person?.status} />
      {(has('scanner') || has('leader') || has('admin') || has('finance')) && (
        <>
          <div className="section-title">{t('home.staff')}</div>
          <div className="tiles">
            {(has('scanner') || has('leader') || has('admin')) && <Tile to="/scan" icon={<ScanLine size={26} aria-hidden />} label={t('home.scan')} primary />}
            {(has('leader') || has('admin')) && <Tile to="/admin/meetings" icon={<CalendarDays size={26} aria-hidden />} label={t('home.meetings')} />}
            {has('admin') && <Tile to="/admin/people" icon={<UsersRound size={26} aria-hidden />} label={t('home.people')} />}
            {has('admin') && <Tile to="/admin/newcomers" icon={<UserPlus size={26} aria-hidden />} label={t('home.newcomers')} />}
            {(has('admin') || has('leader')) && <Tile to="/admin/groups" icon={<ClipboardList size={26} aria-hidden />} label={t('home.groups')} />}
            {(has('admin') || has('leader')) && <Tile to="/leader/attendance" icon={<BarChart3 size={26} aria-hidden />} label={t('home.groupAtt')} />}
            {has('admin') && <Tile to="/admin/posters" icon={<Printer size={26} aria-hidden />} label={t('home.posters')} />}
            {has('admin') && <Tile to="/admin/settings" icon={<Settings size={26} aria-hidden />} label={t('home.settings')} />}
            {(has('finance') || has('admin')) && <Tile to="/finance/offerings" icon={<Wallet size={26} aria-hidden />} label={t('home.finance')} />}
            {(has('finance') || has('admin')) && <Tile to="/finance/export" icon={<Download size={26} aria-hidden />} label={t('home.export')} />}
          </div>
        </>
      )}
      <button className="btn block" style={{ marginTop: 24 }} onClick={signOut}><LogOut size={20} aria-hidden />{t('home.signOut')}</button>
    </div>
  );
}
