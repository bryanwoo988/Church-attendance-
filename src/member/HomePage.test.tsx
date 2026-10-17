import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Person } from '../../shared/types';
import { klDate } from '../../shared/dates';

const P = (id: string, name: string, noQr = false): Person => ({ id, name, kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date(), noQr });
vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../api', () => ({
  useHousehold: () => [P('p1', 'Josephine'), P('p2', 'Timothy'), P('b1', 'Baby', true)],
  useSettings: () => ({ selfCheckin: false }),
  useHouseholdDoc: () => ({ id: 'h1', today: { date: klDate(new Date()), personIds: ['p1', 'b1'] } }),
}));

import { AuthContext } from '../auth/AuthProvider';
import HomePage from './HomePage';
import { t } from '../i18n';

describe('HomePage', () => {
  it("hides QR codes of members without one, and shows today's list", () => {
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] }, person: P('p1', 'Josephine') }}>
          <HomePage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Timothy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Baby' })).not.toBeInTheDocument();
    expect(screen.getByText(t('family.todaySaved', { names: 'Josephine、Baby' }))).toBeInTheDocument();
  });
});
