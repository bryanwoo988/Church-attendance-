export const SERVER_WAIT_MS = 2500;

/**
 * Wait briefly for a Firestore write's server acknowledgement. Firestore has already applied the
 * write locally and will sync it later, so 'pending' means "saved on this device, not yet synced".
 */
export function settleWithin(p: Promise<unknown>, ms = SERVER_WAIT_MS): Promise<'done' | 'pending'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('pending'), ms);
    p.then(
      () => { clearTimeout(timer); resolve('done'); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
