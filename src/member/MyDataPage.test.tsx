import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const call = vi.fn().mockResolvedValue({ ok: true });
vi.mock('../firebase', () => ({ call: (...a: unknown[]) => call(...a), auth: {}, db: {} }));
vi.mock('../api', () => ({
  useHousehold: () => [{ id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', phone: '+60123456789', active: true, visitCount: 0, createdAt: new Date() }],
  useHouseholdAttendance: () => [],
}));

import { AuthContext } from '../auth/AuthProvider';
import MyDataPage from './MyDataPage';
import { t } from '../i18n';

describe('MyDataPage', () => {
  it('shows stored data and deletes only after typing DELETE', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] } }}>
          <MyDataPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('+60123456789')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: t('mydata.delete') });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(t('mydata.typeDelete')), 'DELETE');
    await userEvent.click(btn);
    expect(call).toHaveBeenCalledWith('deleteMyData', { confirm: 'DELETE' });
    expect(signOut).toHaveBeenCalled();
  });
});
