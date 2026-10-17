import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

let decode: (text: string) => void = () => {};
vi.mock('./CameraScanner', () => ({
  default: ({ onDecode }: { onDecode: (t: string) => void }) => {
    decode = onDecode;
    return <div>camera</div>;
  },
}));
const recordScan = vi.fn();
vi.mock('./offlineStatus', async (orig) => ({ ...(await orig<object>()), recordScan: (...a: unknown[]) => recordScan(...a) }));
vi.mock('../firebase', () => ({ db: {} }));
let meetings: unknown[] = [];
const P = (id: string, name: string, kind: 'adult' | 'child' = 'adult', accountUid?: string) =>
  ({ id, name, householdId: 'h1', kind, status: 'member', active: true, visitCount: 0, createdAt: new Date(), accountUid });
const fetchPersonWithFamily = vi.fn();
vi.mock('../api', () => ({
  useMeetingsOn: () => meetings,
  usePeople: () => [P('p1', 'Mary'), P('k1', 'Timothy', 'child')],
  useGroups: () => [],
  fetchPersonWithFamily: (...a: unknown[]) => fetchPersonWithFamily(...a),
}));

import { AuthContext } from '../auth/AuthProvider';
import ScannerPage from './ScannerPage';
import { t, setLang } from '../i18n';
import { klDate } from '../../shared/dates';

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u_scan', roles: ['scanner'], signOut: async () => {}, user: { uid: 'u_scan', personId: 'px', householdId: 'hx', roles: ['scanner'] } }}>
        <ScannerPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setLang('zh');
  recordScan.mockReset();
  fetchPersonWithFamily.mockReset().mockResolvedValue({ person: P('p1', 'Mary'), family: [P('p1', 'Mary')] });
  meetings = [{ id: 'sunday-x', type: 'sunday', title: '主日', date: '2026-10-18', checkinMode: 'always' }];
});

describe('ScannerPage', () => {
  it('switches between scanning and manual check-in; manual hides the camera', async () => {
    renderPage();
    expect(screen.getByText('camera')).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: t('scan.tabManual') }).click());
    expect(screen.queryByText('camera')).not.toBeInTheDocument();
    expect(screen.getByLabelText(t('manual.search'))).toBeInTheDocument();
    await act(async () => screen.getByRole('button', { name: t('scan.tabScan') }).click());
    expect(screen.getByText('camera')).toBeInTheDocument();
  });

  it('explains why there is nothing to scan when no meeting is on today', () => {
    meetings = [];
    renderPage();
    expect(screen.getByText(t('scan.noMeetingWhy'))).toBeInTheDocument();
  });

  it('shows a message for a non-church QR', async () => {
    renderPage();
    await act(async () => decode('https://shop.example'));
    expect(screen.getByText(t('scan.notChurchQr'))).toBeInTheDocument();
  });

  it('records a single person and shows the offline notice when queued', async () => {
    recordScan.mockResolvedValue([{ personId: 'p1', status: 'queued' }]);
    renderPage();
    await act(async () => decode('cqr:p:p1'));
    expect(recordScan).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(t('scan.savedOffline'))).toBeInTheDocument();
    expect(screen.getByText('Mary')).toBeInTheDocument();
  });

  it('writes once for a double scan', async () => {
    recordScan.mockResolvedValue([{ personId: 'p1', status: 'ok' }]);
    renderPage();
    await act(async () => decode('cqr:p:p1'));
    await act(async () => decode('cqr:p:p1'));
    expect(recordScan).toHaveBeenCalledTimes(1);
  });

  it('shows already checked in', async () => {
    recordScan.mockResolvedValue([{ personId: 'p1', status: 'already' }]);
    renderPage();
    await act(async () => decode('cqr:p:p1'));
    expect(await screen.findByText(t('scan.already'))).toBeInTheDocument();
  });

  it("a child's QR brings up the whole family, scanned child first, all ticked", async () => {
    fetchPersonWithFamily.mockResolvedValue({ person: P('k1', 'Timothy', 'child'), family: [P('p1', 'Mary', 'adult', 'u1'), P('k1', 'Timothy', 'child')] });
    recordScan.mockResolvedValue([{ personId: 'k1', status: 'ok' }, { personId: 'p1', status: 'ok' }]);
    renderPage();
    await act(async () => decode('cqr:p:k1'));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => (b as HTMLInputElement).checked)).toBe(true);
    await act(async () => screen.getByRole('button', { name: t('checkin.confirm', { n: 2 }) }).click());
    expect(recordScan).toHaveBeenCalledWith('sunday-x', '2026-10-18', ['k1', 'p1'], 'u_scan');
  });

  it('manual check-in of someone with family also offers the family', async () => {
    fetchPersonWithFamily.mockResolvedValue({ person: P('k1', 'Timothy', 'child'), family: [P('p1', 'Mary'), P('k1', 'Timothy', 'child')] });
    renderPage();
    await act(async () => screen.getByRole('button', { name: t('scan.tabManual') }).click());
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.type(screen.getByLabelText(t('manual.search')), 'Tim');
    await userEvent.click(screen.getByRole('button', { name: /Timothy/ }));
    expect(await screen.findByText(t('checkin.whoCame'))).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it("pre-ticks the family's list for today and waits for the scanner to confirm", async () => {
    fetchPersonWithFamily.mockResolvedValue({
      person: P('k1', 'Timothy', 'child'),
      family: [P('p1', 'Mary'), P('k1', 'Timothy', 'child'), P('b1', 'Baby', 'child'), P('d1', 'Dad')],
      today: { date: klDate(new Date()), personIds: ['p1', 'b1'] },
    });
    recordScan.mockResolvedValue([{ personId: 'k1', status: 'ok' }]);
    renderPage();
    await act(async () => decode('cqr:p:k1'));
    expect(recordScan).not.toHaveBeenCalled();
    const ticked = (name: string) => (screen.getByRole('checkbox', { name }) as HTMLInputElement).checked;
    expect([ticked('Timothy'), ticked('Mary'), ticked('Baby'), ticked('Dad')]).toEqual([true, true, true, false]);
    await act(async () => screen.getByRole('button', { name: t('checkin.confirm', { n: 3 }) }).click());
    expect(recordScan).toHaveBeenCalledWith('sunday-x', '2026-10-18', ['k1', 'p1', 'b1'], 'u_scan');
  });
});
