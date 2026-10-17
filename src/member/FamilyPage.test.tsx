import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const addFamilyMember = vi.fn().mockResolvedValue('newId');
const updateFamilyMember = vi.fn().mockResolvedValue(undefined);
const saveHousehold = vi.fn().mockResolvedValue(undefined);
let household: object = {};
vi.mock('../api', () => ({
  addFamilyMember: (...a: unknown[]) => addFamilyMember(...a),
  useHousehold: () => [
    { id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() },
    { id: 'p2', name: 'Kid', kind: 'child', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() },
  ],
  updateFamilyMember: (...a: unknown[]) => updateFamilyMember(...a),
  saveHousehold: (...a: unknown[]) => saveHousehold(...a),
  useHouseholdDoc: () => household,
}));
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));

import { AuthContext } from '../auth/AuthProvider';
import FamilyPage from './FamilyPage';
import { t, setLang } from '../i18n';
import { klDate } from '../../shared/dates';

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut: async () => {}, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] }, person: { id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', active: true, visitCount: 0, createdAt: new Date() } }}>
        <FamilyPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setLang('zh');
  addFamilyMember.mockClear();
  updateFamilyMember.mockReset().mockResolvedValue(undefined);
  saveHousehold.mockReset().mockResolvedValue(undefined);
  household = {};
});
const today = klDate(new Date());

describe('FamilyPage', () => {
  it('lists family members', () => {
    renderPage();
    expect(screen.getByRole('button', { name: `${t('family.edit')} Kid` })).toBeInTheDocument();
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
    expect(addFamilyMember).toHaveBeenCalledWith({ householdId: 'h1', name: 'Baby', kind: 'child', status: 'member', noQr: true });
  });

  it('edits a family member name and adult/child', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: `${t('family.edit')} Kid` }));
    const input = screen.getByLabelText(t('family.editName'));
    await userEvent.clear(input);
    await userEvent.type(input, 'Kid Tan');
    await userEvent.click(screen.getByLabelText(t('family.adult'), { selector: '#edit-adult' }));
    await userEvent.click(screen.getByLabelText(t('family.needQr'), { selector: '#edit-qr' }));
    await userEvent.click(screen.getByRole('button', { name: t('family.save') }));
    expect(updateFamilyMember).toHaveBeenCalledWith('p2', { name: 'Kid Tan', kind: 'adult', noQr: true });
  });

  it('removes a family member after an in-app confirmation', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: `${t('family.edit')} Kid` }));
    await userEvent.click(screen.getByRole('button', { name: t('family.remove') }));
    expect(updateFamilyMember).not.toHaveBeenCalled();
    expect(screen.getByText(t('family.removeConfirm', { name: 'Kid' }))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('family.removeYes') }));
    expect(updateFamilyMember).toHaveBeenCalledWith('p2', { active: false });
  });

  it('shows an error when saving fails', async () => {
    updateFamilyMember.mockRejectedValue(new Error('denied'));
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: `${t('family.edit')} Kid` }));
    await userEvent.click(screen.getByRole('button', { name: t('family.save') }));
    expect(await screen.findByText(t('common.error'))).toBeInTheDocument();
  });

  it('cannot remove yourself', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: `${t('family.edit')} Mary` }));
    expect(screen.queryByRole('button', { name: t('family.remove') })).not.toBeInTheDocument();
  });

  it("saves today's attendees, picked via a saved combination", async () => {
    household = { presets: [{ name: '只有我', personIds: ['p1'], qr: false }] };
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: '只有我' }));
    const today = screen.getByRole('group', { name: t('family.todayTitle') });
    expect(within(today).getByLabelText('Mary')).toBeChecked();
    expect(within(today).getByLabelText('Kid')).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: t('family.todaySave') }));
    expect(saveHousehold).toHaveBeenCalledWith('h1', { today: { date: klDate(new Date()), personIds: ['p1'], qr: false } });
  });

  it('shows the list already saved for today', () => {
    household = { today: { date: today, personIds: ['p2'] } };
    renderPage();
    expect(screen.getByText(t('family.todaySaved', { names: 'Kid' }))).toBeInTheDocument();
  });

  it('saves the ticked members as a named combination', async () => {
    household = { presets: [{ name: 'A', personIds: ['p1'] }] };
    renderPage();
    const today = screen.getByRole('group', { name: t('family.todayTitle') });
    await userEvent.click(within(today).getByLabelText('Kid'));
    await userEvent.click(within(today).getByLabelText(t('family.eachQr')));
    await userEvent.type(screen.getByLabelText(t('family.presetName')), '我和孩子');
    await userEvent.click(screen.getByRole('button', { name: t('family.presetSave') }));
    expect(saveHousehold).toHaveBeenCalledWith('h1', { presets: [{ name: 'A', personIds: ['p1'] }, { name: '我和孩子', personIds: ['p2'], qr: false }] });
  });

  it('deletes a combination', async () => {
    household = { presets: [{ name: 'A', personIds: ['p1'] }, { name: 'B', personIds: ['p2'] }] };
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: `${t('family.presetDelete')} A` }));
    expect(saveHousehold).toHaveBeenCalledWith('h1', { presets: [{ name: 'B', personIds: ['p2'] }] });
  });
});
