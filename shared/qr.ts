const PREFIX = 'cqr:p:';
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * A personal code is a link to the app (`<origin>/p/<id>`): the check-in scanner reads the id,
 * while a phone camera opens the app, so newcomers can sign up from any member's code.
 */
export function personalQrPayload(personId: string, origin: string): string {
  return `${origin}/p/${personId}`;
}

/**
 * Returns the person id from a personal QR payload, or null if it is not one.
 * Accepts the link form from our own origins and the older `cqr:p:<id>` form.
 */
export function parsePersonalQr(text: string, origins: string[]): string | null {
  if (text.startsWith(PREFIX)) {
    const id = text.slice(PREFIX.length);
    return ID.test(id) ? id : null;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!origins.includes(url.origin) || url.search || url.hash) return null;
  const m = /^\/p\/([^/]+)$/.exec(url.pathname);
  return m && ID.test(m[1]) ? m[1] : null;
}
