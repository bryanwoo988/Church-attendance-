import { doc, getDoc, getDocFromCache, serverTimestamp, setDoc, type DocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { attendanceId } from '../../shared/checkin';
import { parsePersonalQr } from '../../shared/qr';
import { APP_ORIGINS } from '../util/origins';
import { settleWithin, SERVER_WAIT_MS } from '../util/settle';

export type ScanStatus = 'ok' | 'already' | 'queued';
export interface ScanResult { personId: string; status: ScanStatus; at?: Date }

/** 'already' with the original check-in time when we can read it. */
function already(personId: string, snap?: DocumentSnapshot): ScanResult {
  const at: Date | undefined = snap?.get('at')?.toDate?.();
  return at ? { personId, status: 'already', at } : { personId, status: 'already' };
}

/**
 * Record door-scanner attendance. Offline writes go to Firestore's local queue and sync later;
 * the deterministic doc id makes a re-sync or a second scan harmless.
 */
export async function recordScan(meetingId: string, date: string, personIds: string[], byUid: string, waitMs = SERVER_WAIT_MS): Promise<ScanResult[]> {
  return Promise.all(
    personIds.map(async (personId) => {
      const ref = doc(db, 'attendance', attendanceId(meetingId, personId));
      const cached = await getDocFromCache(ref).catch(() => undefined); // throws when not cached
      if (cached?.exists()) return already(personId, cached);
      const write = setDoc(ref, { meetingId, personId, date, method: 'scanner', byUid, at: serverTimestamp() });
      if (!navigator.onLine) {
        write.catch(() => {});
        return { personId, status: 'queued' as const };
      }
      try {
        // Wi-Fi can be "connected" with no internet behind it; never block the door on the server.
        if ((await settleWithin(write, waitMs)) === 'pending') {
          write.catch(() => {});
          return { personId, status: 'queued' as const };
        }
        return { personId, status: 'ok' as const };
      } catch (e) {
        // Rules allow create only, so an existing record surfaces as permission-denied.
        if ((e as { code?: string })?.code === 'permission-denied') return already(personId, await getDoc(ref).catch(() => undefined));
        throw e;
      }
    }),
  );
}

export type GateResult = { personId: string } | 'notChurch' | 'ignore';

/** Debounces repeated camera decodes of the same code. */
export function makeScanGate(windowMs: number) {
  let lastText = '';
  let lastAt = -Infinity;
  return (text: string, now: number): GateResult => {
    if (text === lastText && now - lastAt < windowMs) return 'ignore';
    lastText = text;
    lastAt = now;
    const personId = parsePersonalQr(text, APP_ORIGINS);
    return personId ? { personId } : 'notChurch';
  };
}
