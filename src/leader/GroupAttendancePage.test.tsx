import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Role } from '../../shared/types';

const P = (id: string, name: string) => ({ id, name, householdId: 'h', kind: 'adult', status: 'member', active: true, visitCount: 0, createdAt: new Date('2026-01-01') });
vi.mock('../api', () => ({
  useGroups: () => [
    { id: 'g1', name: '青年小组', leaderUids: ['u_lead'], memberPersonIds: ['a', 'b'] },
    { id: 'g2', name: '妇女小组', leaderUids: [], memberPersonIds: [] },
  ],
  usePeople: () => [P('a', 'Ann'), P('b', 'Ben')],
  useGroupMeetings: () => [{ id: 'gm1', type: 'group', title: 'G', date: '2026-10-07', groupId: 'g1', checkinMode: 'always' }],
  useAttendanceForMeetings: () => [{ meetingId: 'gm1', personId: 'a', date: '2026-10-07', method: 'scanner', at: new Date() }],
}));

import { AuthContext } from '../auth/AuthProvider';
import GroupAttendancePage from './GroupAttendancePage';
import { setLang } from '../i18n';

function renderAs(uid: string, roles: Role[]) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid, roles, signOut: async () => {}, user: { uid, personId: 'p', householdId: 'h', roles } }}>
        <GroupAttendancePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => setLang('zh'));

describe('GroupAttendancePage', () => {
  it('leader only sees their own groups', () => {
    renderAs('u_lead', ['leader']);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['青年小组']);
  });

  it('shows each member with marks and rate', () => {
    renderAs('u_lead', ['leader']);
    const ann = screen.getByText('Ann').closest('tr')!;
    expect(ann.textContent).toContain('✓');
    expect(ann.textContent).toContain('100%');
    const ben = screen.getByText('Ben').closest('tr')!;
    expect(ben.textContent).toContain('0%');
  });
});
