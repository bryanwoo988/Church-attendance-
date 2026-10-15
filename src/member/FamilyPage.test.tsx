import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const addFamilyMember = vi.fn().mockResolvedValue('newId');
vi.mock('../api', () => ({
  addFamilyMember: (...a: unknown[]) => addFamilyMember(...a),
  useHousehold: () => [
    { id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() },
    { id: 'p2', name: 'Kid', kind: 'child', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() },
  ],
  updateFamilyMember: vi.fn(),
}));
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

import { AuthContext } from '../auth/AuthProvider';
import FamilyPage from './FamilyPage';
import { t, setLang } from '../i18n';

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] }, person: { id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() } }}>
        <FamilyPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => { setLang('zh'); addFamilyMember.mockClear(); });

describe('FamilyPage', () => {
  it('lists family members', () => {
    renderPage();
    expect(screen.getByText('Kid')).toBeInTheDocument();
  });

  it('requires name and adult/child choice before adding', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: t('family.add') }));
    expect(addFamilyMember).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(t('family.name')), 'Baby');
    await userEvent.click(screen.getByRole('button', { name: t('family.add') }));
    expect(addFamilyMember).not.toHaveBeenCalled();
    expect(screen.getByText(t('family.chooseKind'))).toBeInTheDocument();
  });

  it('adds a child to the owner household', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(t('family.name')), 'Baby');
    await userEvent.click(screen.getByLabelText(t('family.child')));
    await userEvent.click(screen.getByRole('button', { name: t('family.add') }));
    expect(addFamilyMember).toHaveBeenCalledWith({ householdId: 'h1', name: 'Baby', kind: 'child', status: 'member' });
  });
});
