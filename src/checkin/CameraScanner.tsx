import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { useT } from '../i18n';

/** Continuous rear-camera QR scanning. Calls onDecode for every decode (callers debounce). */
export default function CameraScanner({ onDecode, paused }: { onDecode: (text: string) => void; paused?: boolean }) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const cb = useRef(onDecode);
  cb.current = onDecode;
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!video.current) return;
    const s = new QrScanner(video.current, (r) => cb.current(r.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      maxScansPerSecond: 8,
      returnDetailedScanResult: true,
    });
    scanner.current = s;
    s.start().catch(() => setError(true));
    return () => {
      s.destroy();
      scanner.current = null;
    };
  }, []);

  useEffect(() => {
    if (!scanner.current) return;
    if (paused) scanner.current.pause();
    else scanner.current.start().catch(() => setError(true));
  }, [paused]);

  return (
    <div className="camera">
      <video ref={video} muted playsInline />
      {error && <p className="err">{t('scan.cameraError')}</p>}
    </div>
  );
}
