import { setLang } from './index';

/** First-run screen: shown in both languages because we don't know which one they read yet. */
export default function LanguagePicker() {
  return (
    <div className="card center" style={{ marginTop: 48 }}>
      <h1>Choose your language</h1>
      <h1>选择语言</h1>
      <div className="grid2" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={() => setLang('en')}>English</button>
        <button className="btn primary" onClick={() => setLang('zh')}>中文</button>
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>You can switch later at the top right. 之后可以在右上角切换。</p>
    </div>
  );
}
