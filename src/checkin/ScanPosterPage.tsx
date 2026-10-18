import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '../i18n';
import { useSettings } from '../api';
import { parsePosterUrl } from '../../shared/poster';
import CameraScanner from './CameraScanner';
import { APP_ORIGINS } from '../util/origins';


/** Member scans the door poster inside the app, then lands on the normal self check-in. */
export default function ScanPosterPage() {
  const { t } = useT();
  const nav = useNavigate();
  const [bad, setBad] = useState(false);
  const settings = useSettings();

  function onDecode(text: string) {
    const route = parsePosterUrl(text, APP_ORIGINS);
    if (route) nav(route, { replace: true });
    else setBad(true);
  }

  if (settings && !settings.selfCheckin) {
    return (
      <div className="card center">
        <p>{t('checkin.selfOff')}</p>
        <Link className="btn block" to="/">{t('common.back')}</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>{t('posterScan.title')}</h1>
      <p className="muted">{t('posterScan.hint')}</p>
      <CameraScanner onDecode={onDecode} />
      {bad && <p className="err" role="alert">{t('posterScan.notPoster')}</p>}
      <Link className="btn block" to="/checkin" style={{ marginTop: 12 }}>{t('posterScan.skip')}</Link>
    </div>
  );
}
