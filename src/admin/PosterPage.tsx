import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { useT, type MessageKey } from '../i18n';

function Poster({ url, title, caption }: { url: string; title: MessageKey | string; caption: MessageKey }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) QRCode.toCanvas(canvas.current, url, { errorCorrectionLevel: 'H', margin: 2, width: 520 }).catch(() => {});
  }, [url]);
  return (
    <section className="poster">
      <h2>{title.includes('.') ? t(title as MessageKey) : title}</h2>
      <canvas ref={canvas} />
      <p>{t(caption)}</p>
      <p className="muted small">{url}</p>
    </section>
  );
}

export default function PosterPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const origin = window.location.origin;
  const m = params.get('m');
  return (
    <div>
      <div className="noprint">
        <h1>{t('home.posters')}</h1>
        <p className="muted">{t('poster.hint')}</p>
        <button className="btn primary block" onClick={() => window.print()}>{t('poster.print')}</button>
      </div>
      {m ? (
        <Poster url={`${origin}/checkin?m=${encodeURIComponent(m)}`} title="poster.meetingTitle" caption="poster.checkinCaption" />
      ) : (
        <>
          <Poster url={`${origin}/checkin`} title="poster.checkinTitle" caption="poster.checkinCaption" />
          <Poster url={`${origin}/welcome`} title="poster.welcomeTitle" caption="poster.welcomeCaption" />
        </>
      )}
    </div>
  );
}
