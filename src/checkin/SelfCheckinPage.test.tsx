import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Person } from '../../shared/types';

const call = vi.fn();
vi.mock('../firebase', () => ({ call: (...a: unknown[]) => call(...a), db: {}, auth: {} }));
let family: Person[] = [];
vi.mock('../api', () => ({ useHousehold: () => family }));

import { AuthContext } from '../auth/AuthProvider';
import SelfCheckinPage from './SelfCheckinPage';
import { t, setLang } from '../i18n';

const P = (id: string, name: string, kind: 'adult' | 'child' = 'adult'): Person => ({ id, name, kind, householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() });

function renderPage(url = '/checkin') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] } }}>
        <SelfCheckinPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setLang('zh');
  call.mockReset();
});

describe('SelfCheckinPage', () => {
  it('single-person household checks in immediately', async () => {
    family = [P('p1', 'Mary')];
    call.mockResolvedValue({ meetingId: 'm', meetingTitle: '主日', results: [{ personId: 'p1', status: 'ok' }] });
    renderPage();
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    expect(call).toHaveBeenCalledWith('selfCheckIn', { personIds: ['p1'] });
    expect(await screen.findByText(t('scan.ok'))).toBeInTheDocument();
  });

  it('passes the meeting id from the poster link', async () => {
    family = [P('p1', 'Mary')];
    call.mockResolvedValue({ meetingId: 'g1', meetingTitle: '小组', results: [{ personId: 'p1', status: 'ok' }] });
    renderPage('/checkin?m=g1');
    await waitFor(() => expect(call).toHaveBeenCalledWith('selfCheckIn', { personIds: ['p1'], meetingId: 'g1' }));
  });

  it('family can untick someone', async () => {
    family = [P('p1', 'Mary'), P('p2', 'Kid', 'child'), P('p3', 'Dad')];
    call.mockResolvedValue({ meetingId: 'm', meetingTitle: '主日', results: [{ personId: 'p1', status: 'ok' }, { personId: 'p2', status: 'ok' }] });
    renderPage();
    await userEvent.click(screen.getByLabelText('Dad'));
    await userEvent.click(screen.getByRole('button', { name: t('checkin.confirm', { n: 2 }) }));
    expect(call).toHaveBeenCalledWith('selfCheckIn', { personIds: ['p1', 'p2'] });
  });

  it('shows the closed message', async () => {
    family = [P('p1', 'Mary')];
    call.mockRejectedValue({ code: 'functions/failed-precondition', message: 'checkin.closed' });
    renderPage();
    expect(await screen.findByText(t('checkin.closed'))).toBeInTheDocument();
  });
});
