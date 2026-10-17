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
vi.mock('../api', () => ({
  useMeetingsOn: () => meetings,
  usePeople: () => [],
  useGroups: () => [],
  fetchPersonWithFamily: vi.fn().mockResolvedValue({
    person: { id: 'p1', name: 'Mary', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0, createdAt: new Date() },
    family: [{ id: 'p1', name: 'Mary', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 0, createdAt: new Date() }],
  }),
}));

import { AuthContext } from '../auth/AuthProvider';
import ScannerPage from './ScannerPage';
import { t, setLang } from '../i18n';

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
});
