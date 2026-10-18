import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Person } from '../../shared/types';

const setRoles = vi.fn().mockResolvedValue(undefined);
const updatePerson = vi.fn().mockResolvedValue(undefined);
const call = vi.fn().mockResolvedValue({ movedAttendance: 1, movedOfferings: 0 });
vi.mock('../api', () => ({
  setRoles: (...a: unknown[]) => setRoles(...a),
  updatePerson: (...a: unknown[]) => updatePerson(...a),
}));
vi.mock('../firebase', () => ({ call: (...a: unknown[]) => call(...a) }));

import PersonEditor from './PersonEditor';
import ConfirmHost from '../ui/ConfirmHost';
import { t, setLang } from '../i18n';

const base: Person = { id: 'p1', name: 'Mary', householdId: 'h1', kind: 'adult', status: 'member', active: true, visitCount: 3, createdAt: new Date() };
const other: Person = { ...base, id: 'p2', name: 'Mary Tan (old)', householdId: 'h2' };

beforeEach(() => { setLang('zh'); setRoles.mockClear(); call.mockClear(); });

describe('PersonEditor', () => {
  it('toggling finance writes roles including finance', async () => {
    render(<PersonEditor person={{ ...base, accountUid: 'u1' }} roles={['scanner']} people={[base, other]} onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText(t('role.finance')));
    expect(setRoles).toHaveBeenCalledWith('u1', ['scanner', 'finance']);
  });

  it('hides roles for a person without an account', () => {
    render(<PersonEditor person={base} roles={[]} people={[base, other]} onClose={() => {}} />);
    expect(screen.queryByLabelText(t('role.finance'))).toBeNull();
    expect(screen.getByText(t('person.noAccount'))).toBeInTheDocument();
  });

  it('merges only after confirmation in the app (not the browser dialog)', async () => {
    render(<><PersonEditor person={other} roles={[]} people={[base, other]} onClose={() => {}} /><ConfirmHost /></>);
    await userEvent.selectOptions(screen.getByLabelText(t('person.mergeInto')), 'p1');
    await userEvent.click(screen.getByRole('button', { name: t('person.merge') }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
    expect(call).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: t('person.merge') }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('person.merge') }));
    expect(call).toHaveBeenCalledWith('mergePeople', { fromPersonId: 'p2', intoPersonId: 'p1' });
  });

  it('changes status', async () => {
    render(<PersonEditor person={base} roles={[]} people={[base]} onClose={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText(t('person.status')), 'regular');
    await userEvent.click(screen.getByRole('button', { name: t('common.save') }));
    expect(updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({ status: 'regular' }));
  });
});
