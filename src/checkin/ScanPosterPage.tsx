import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '../i18n';
import { parsePosterUrl } from '../../shared/poster';
import CameraScanner from './CameraScanner';

const project = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
// Posters may have been printed from either Firebase Hosting domain.
const ORIGINS = [window.location.origin, ...(project ? [`https://${project}.web.app`, `https://${project}.firebaseapp.com`] : [])];

/** Member scans the door poster inside the app, then lands on the normal self check-in. */
export default function ScanPosterPage() {
  const { t } = useT();
  const nav = useNavigate();
  const [bad, setBad] = useState(false);

  function onDecode(text: string) {
    const route = parsePosterUrl(text, ORIGINS);
    if (route) nav(route, { replace: true });
    else setBad(true);
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
