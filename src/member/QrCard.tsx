import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { personalQrPayload } from '../../shared/qr';

export default function QrCard({ personId, name, caption }: { personId: string; name: string; caption?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) {
      QRCode.toCanvas(canvas.current, personalQrPayload(personId), { errorCorrectionLevel: 'M', margin: 2, width: 260, color: { dark: '#000000', light: '#ffffff' } }).catch(() => {});
    }
  }, [personId]);
  return (
    <div className="qrcard">
      <canvas ref={canvas} aria-label={name} />
      <div className="qrname">{name}</div>
      {caption && <div className="muted">{caption}</div>}
    </div>
  );
}
