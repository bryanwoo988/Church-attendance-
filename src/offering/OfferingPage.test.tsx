import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { klDate } from '../../shared/dates';

const addOffering = vi.fn().mockResolvedValue('o1');
let offerings: unknown[] = [];
vi.mock('../api', () => ({
  addOffering: (...a: unknown[]) => addOffering(...a),
  updateOwnOffering: vi.fn(),
  deleteOwnOffering: vi.fn(),
  useSettings: () => ({ paymentQrDataUrl: 'data:image/png;base64,AAAA', offeringCategories: ['一般奉献 General', '建堂 Building'], sunday: { weekday: 0, start: '09:00', end: '11:30', checkinMode: 'window' } }),
  useMyOfferings: () => offerings,
}));

import { AuthContext } from '../auth/AuthProvider';
import OfferingPage from './OfferingPage';
import { t, setLang } from '../i18n';

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] } }}>
        <OfferingPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => { setLang('zh'); addOffering.mockClear(); offerings = []; });

async function goToAmount() {
  renderPage();
  expect(screen.getByAltText(t('offering.qrAlt'))).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: t('offering.paid') }));
}

describe('OfferingPage', () => {
  it('records RM 1,000 as 100000 sen on the KL date', async () => {
    await goToAmount();
    await userEvent.type(screen.getByLabelText(t('offering.amount')), 'RM 1,000');
    await userEvent.click(screen.getByRole('button', { name: t('offering.submit') }));
    expect(addOffering).toHaveBeenCalledWith({ uid: 'u1', personId: 'p1', householdId: 'h1', amountSen: 100000, category: '一般奉献 General', date: klDate(new Date()) });
  });

  it('rejects zero and writes nothing', async () => {
    await goToAmount();
    await userEvent.type(screen.getByLabelText(t('offering.amount')), '0');
    await userEvent.click(screen.getByRole('button', { name: t('offering.submit') }));
    expect(screen.getByText(t('offering.zero'))).toBeInTheDocument();
    expect(addOffering).not.toHaveBeenCalled();
  });

  it('hides edit for a record older than 24 hours', () => {
    offerings = [
      { id: 'old', uid: 'u1', personId: 'p1', householdId: 'h1', date: '2026-10-01', amountSen: 5000, category: 'x', createdAt: new Date(Date.now() - 25 * 3600_000) },
      { id: 'new', uid: 'u1', personId: 'p1', householdId: 'h1', date: '2026-10-18', amountSen: 6000, category: 'x', createdAt: new Date(Date.now() - 3600_000) },
    ];
    renderPage();
    expect(screen.getAllByRole('button', { name: t('offering.edit') })).toHaveLength(1);
  });
});

describe('OfferingPage offline', () => {
  it('shows saved when the server does not answer', async () => {
    addOffering.mockReturnValueOnce(new Promise(() => {}));
    await goToAmount();
    await userEvent.type(screen.getByLabelText(t('offering.amount')), '20');
    await userEvent.click(screen.getByRole('button', { name: t('offering.submit') }));
    expect(await screen.findByText(t('offering.saved', { amount: 'RM 20.00' }), {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
