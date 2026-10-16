const PREFIX = 'cqr:p:';

export function personalQrPayload(personId: string): string {
  return PREFIX + personId;
}

/** Returns the person id from a personal QR payload, or null if it is not one. */
export function parsePersonalQr(text: string): string | null {
  if (!text.startsWith(PREFIX)) return null;
  const id = text.slice(PREFIX.length);
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}
