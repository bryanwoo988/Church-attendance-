import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocFromCache = vi.fn();
const setDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  getDocFromCache: (...a: unknown[]) => getDocFromCache(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  serverTimestamp: () => 'TS',
}));
vi.mock('../firebase', () => ({ db: {} }));

import { recordScan, makeScanGate } from './offlineStatus';

const online = (v: boolean) => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });

beforeEach(() => {
  getDocFromCache.mockReset().mockRejectedValue(new Error('not cached'));
  setDoc.mockReset().mockResolvedValue(undefined);
  online(true);
});

describe('recordScan', () => {
  it('returns already when the record is cached', async () => {
    getDocFromCache.mockResolvedValue({ exists: () => true });
    expect(await recordScan('m1', '2026-10-18', ['p1'], 'u1')).toEqual([{ personId: 'p1', status: 'already' }]);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('writes a new record when online', async () => {
    expect(await recordScan('m1', '2026-10-18', ['p1'], 'u1')).toEqual([{ personId: 'p1', status: 'ok' }]);
    expect(setDoc).toHaveBeenCalledWith({ path: 'attendance/m1_p1' }, { meetingId: 'm1', personId: 'p1', date: '2026-10-18', method: 'scanner', byUid: 'u1', at: 'TS' });
  });

  it('treats a permission error on an existing server record as already', async () => {
    setDoc.mockRejectedValue({ code: 'permission-denied' });
    expect(await recordScan('m1', '2026-10-18', ['p1'], 'u1')).toEqual([{ personId: 'p1', status: 'already' }]);
  });

  it('queues when offline without waiting for the server', async () => {
    online(false);
    setDoc.mockReturnValue(new Promise(() => {}));
    expect(await recordScan('m1', '2026-10-18', ['p1', 'p2'], 'u1')).toEqual([
      { personId: 'p1', status: 'queued' },
      { personId: 'p2', status: 'queued' },
    ]);
  });
});

describe('makeScanGate', () => {
  it('ignores the same QR within 3 seconds', () => {
    const gate = makeScanGate(3000);
    expect(gate('cqr:p:abc', 0)).toEqual({ personId: 'abc' });
    expect(gate('cqr:p:abc', 2000)).toBe('ignore');
    expect(gate('cqr:p:abc', 3500)).toEqual({ personId: 'abc' });
  });
  it('flags non-church QR codes once', () => {
    const gate = makeScanGate(3000);
    expect(gate('https://shop.example', 0)).toBe('notChurch');
    expect(gate('https://shop.example', 100)).toBe('ignore');
  });
});
