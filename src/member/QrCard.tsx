import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share, X } from 'lucide-react';
import { personalQrPayload } from '../../shared/qr';
import { useT } from '../i18n';
import { haptic } from '../ui/haptic';
import { toast } from '../ui/toast';

/** PNG of the code with the name under it, for saving to Photos or sharing. */
async function namedQrBlob(payload: string, name: string): Promise<Blob | null> {
  const qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 720 });
  const img = new Image();
  img.src = qr;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 840;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, 720, 720);
  ctx.fillStyle = '#1f1a17';
  ctx.font = '600 44px -apple-system, "PingFang SC", Roboto, "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 360, 790, 680);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

function QrViewer({ payload, name, onClose }: { payload: string; name: string; onClose: () => void }) {
  const { t } = useT();
  const [src, setSrc] = useState<string | null>(null);
  const fileName = `QR-${name.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`;

  useEffect(() => {
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 2, width: 720 }).then(setSrc).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [payload, onClose]);

  async function file(): Promise<File | null> {
    const blob = await namedQrBlob(payload, name).catch(() => null);
    return blob ? new File([blob], fileName, { type: 'image/png' }) : null;
  }

  async function share() {
    const f = await file();
    if (f && navigator.canShare?.({ files: [f] })) {
      // iPhone: the share sheet has "Save Image" (to Photos).
      await navigator.share({ files: [f], title: name }).catch(() => {});
    } else {
      await download();
    }
  }

  async function download() {
    const f = await file();
    if (!f) return;
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ kind: 'ok', title: t('qr.saved') });
  }

  return (
    <div className="qr-viewer" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <button className="icon-btn close" aria-label={t('common.close')} onClick={onClose}><X size={28} aria-hidden /></button>
      <div className="qr-big" onClick={(e) => e.stopPropagation()}>
        {src && <img src={src} alt={name} />}
      </div>
      <div className="qrname">{name}</div>
      <div className="actions" onClick={(e) => e.stopPropagation()}>
        {typeof navigator.share === 'function' && (
          <button className="btn primary block" onClick={share}><Share size={20} aria-hidden />{t('qr.save')}</button>
        )}
        <button className="btn block" onClick={download}><Download size={20} aria-hidden />{t('qr.download')}</button>
      </div>
    </div>
  );
}

export default function QrCard({ personId, name, caption }: { personId: string; name: string; caption?: string }) {
  const { t } = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const payload = personalQrPayload(personId, window.location.origin);

  useEffect(() => {
    if (canvas.current) {
      QRCode.toCanvas(canvas.current, payload, { errorCorrectionLevel: 'M', margin: 2, width: 260, color: { dark: '#000000', light: '#ffffff' } }).catch(() => {});
    }
  }, [payload]);

  function pop() {
    haptic(15);
    setOpen(true);
  }

  return (
    <div className="qrcard">
      <button className="qr-press" aria-label={`${name} — ${t('qr.tapHint')}`} onClick={pop} onContextMenu={(e) => { e.preventDefault(); pop(); }}>
        <canvas ref={canvas} aria-hidden />
      </button>
      <div className="qrname">{name}</div>
      {caption && <div className="muted">{caption}</div>}
      <div className="muted small">{t('qr.tapHint')}</div>
      {open && <QrViewer payload={payload} name={name} onClose={() => setOpen(false)} />}
    </div>
  );
}
