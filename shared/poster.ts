/**
 * Map text scanned from a church poster to the in-app route it points at.
 * Only our own origins and the two poster paths are accepted, so a random QR code can't navigate the app.
 */
export function parsePosterUrl(text: string, origins: string[]): string | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!origins.includes(url.origin)) return null;
  if (url.pathname === '/welcome') return '/welcome';
  if (url.pathname !== '/checkin') return null;
  const m = url.searchParams.get('m');
  return m ? `/checkin?m=${encodeURIComponent(m)}` : '/checkin';
}
