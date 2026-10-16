import { Outlet, Link } from 'react-router';
import { useT } from './i18n';
import './app.css';

export default function App() {
  const { t, lang, setLang } = useT();
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">{t('app.title')}</Link>
        <button className="lang" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          {t('lang.toggle')}
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
