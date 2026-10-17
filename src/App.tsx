import { Outlet, Link, useLocation } from 'react-router';
import { useT } from './i18n';
import { useAppUpdated } from './util/useAppUpdated';
import './app.css';

export default function App() {
  const { t, lang, setLang } = useT();
  const updated = useAppUpdated();
  const atHome = useLocation().pathname === '/';
  return (
    <div className="shell">
      <header className="topbar">
        {atHome ? <Link to="/" className="brand">{t('app.title')}</Link> : <Link to="/" className="brand">{t('nav.home')}</Link>}
        <button className="lang" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          {t('lang.toggle')}
        </button>
      </header>
      {updated && (
        <button className="btn primary block" style={{ borderRadius: 0 }} onClick={() => window.location.reload()}>{t('update.ready')}</button>
      )}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
