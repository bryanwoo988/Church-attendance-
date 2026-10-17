import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../firebase', () => ({ call: vi.fn(), auth: {}, db: {} }));
vi.mock('../api', () => ({
  useHousehold: () => [{ id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() }],
  useHouseholdAttendance: () => [{ meetingId: 's1', personId: 'p1', date: '2026-10-18', method: 'scanner', at: new Date('2026-10-18T01:05:00Z') }],
  useGroups: () => [],
  useMeetingsByIds: () => [{ id: 's1', type: 'sunday', title: '主日', date: '2026-10-18', checkinMode: 'always' }],
}));

import { AuthContext } from '../auth/AuthProvider';
import HistoryPage from './HistoryPage';
import { t } from '../i18n';

describe('HistoryPage', () => {
  it('lists past check-ins with meeting, time and method', () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] } }}>
          <HistoryPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: t('history.title') })).toBeInTheDocument();
    expect(screen.getByText(`${t('rec.sunday')} · 2026-10-18`)).toBeInTheDocument();
    expect(screen.getByText('2026-10-18 09:05')).toBeInTheDocument();
    expect(screen.getByText(`Mary · ${t('method.scanner')}`)).toBeInTheDocument();
  });
});
