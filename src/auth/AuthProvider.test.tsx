import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => { cb({ uid: 'u1' }); return () => {}; },
  signOut: vi.fn(),
}));
const call = vi.fn().mockRejectedValue(new Error('offline'));
vi.mock('../firebase', () => ({ auth: {}, db: {}, call: (...a: unknown[]) => call(...a) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ personId: 'p1', householdId: 'h1', roles: ['scanner'] }) }),
  onSnapshot: (ref: { path: string }, cb: (s: unknown) => void) => {
    if (ref.path === 'users/u1') cb({ exists: () => true, data: () => ({ personId: 'p1', householdId: 'h1', roles: ['scanner'] }) });
    return () => {};
  },
}));

import { AuthProvider, useAuth } from './AuthProvider';

function Show() {
  const a = useAuth();
  return <p>{a.status}:{a.roles.join(',')}</p>;
}

describe('AuthProvider offline', () => {
  it('is ready from the cached profile even when ensureProfile cannot be reached', async () => {
    render(<AuthProvider><Show /></AuthProvider>);
    expect(await screen.findByText('ready:scanner')).toBeInTheDocument();
  });
});
