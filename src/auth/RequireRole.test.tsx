import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../firebase', () => ({ auth: {}, db: {}, call: vi.fn() }));

import { AuthContext, type AuthState } from './AuthProvider';
import { RequireRole } from './RequireRole';
import { t } from '../i18n';

const state = (roles: AuthState['roles']): AuthState => ({ status: 'ready', uid: 'u', roles, signOut: async () => {} });

function renderWith(roles: AuthState['roles']) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={state(roles)}>
        <RequireRole any={['finance']}><p>secret</p></RequireRole>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('renders children for finance', () => {
    renderWith(['finance']);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('shows no-permission for a member', () => {
    renderWith([]);
    expect(screen.queryByText('secret')).toBeNull();
    expect(screen.getByText(t('common.noPermission'))).toBeInTheDocument();
  });
});
