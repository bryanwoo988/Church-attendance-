import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Person } from '../../shared/types';
import { klDate } from '../../shared/dates';

const P = (id: string, name: string, noQr = false): Person => ({ id, name, kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date(), noQr });
vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));
let today: object | undefined;
vi.mock('../api', () => ({
  useHousehold: () => [P('p1', 'Josephine'), P('p2', 'Timothy'), P('b1', 'Baby', true), P('p3', 'Isaac')],
  useSettings: () => ({ selfCheckin: false }),
  useHouseholdDoc: () => ({ id: 'h1', today }),
}));

import { AuthContext } from '../auth/AuthProvider';
import HomePage from './HomePage';
import { t } from '../i18n';

function renderHome() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] }, person: P('p1', 'Josephine') }}>
        <HomePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  it('without a list for today, shows every member who has a QR code', () => {
    today = undefined;
    renderHome();
    expect(screen.getByRole('button', { name: 'Timothy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Isaac' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Baby' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('home.todaySet') })).toBeInTheDocument();
  });

  it("with today's list and own QR codes on, shows only listed members' codes", () => {
    today = { date: klDate(new Date()), personIds: ['p1', 'p2', 'b1'], qr: true };
    renderHome();
    expect(screen.getByRole('button', { name: 'Timothy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Isaac' })).not.toBeInTheDocument();
    expect(screen.getByText(t('family.todaySaved', { names: 'Josephine、Timothy、Baby' }))).toBeInTheDocument();
  });

  it("with today's list and own QR codes off, shows one family QR code", () => {
    today = { date: klDate(new Date()), personIds: ['p1', 'p2', 'b1'], qr: false };
    renderHome();
    expect(screen.getByText(t('home.familyQr'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Timothy' })).not.toBeInTheDocument();
  });
});
