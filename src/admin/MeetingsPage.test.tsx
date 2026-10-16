import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Role } from '../../shared/types';

const createMeeting = vi.fn().mockResolvedValue('m1');
vi.mock('../api', () => ({
  createMeeting: (...a: unknown[]) => createMeeting(...a),
  useMeetingsBetween: () => [],
  useGroups: () => [
    { id: 'g1', name: '青年小组', leaderUids: ['u_lead'], memberPersonIds: [] },
    { id: 'g2', name: '妇女小组', leaderUids: [], memberPersonIds: [] },
  ],
}));
vi.mock('../firebase', () => ({ call: vi.fn() }));

import { AuthContext } from '../auth/AuthProvider';
import MeetingsPage from './MeetingsPage';
import { t, setLang } from '../i18n';

function renderAs(uid: string, roles: Role[]) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid, roles, signOut: async () => {}, user: { uid, personId: 'p', householdId: 'h', roles } }}>
        <MeetingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => { setLang('zh'); createMeeting.mockClear(); });

describe('MeetingsPage', () => {
  it('requires start and end for a time-limited meeting', async () => {
    renderAs('u_admin', ['admin']);
    await userEvent.type(screen.getByLabelText(t('meeting.title')), '祷告会');
    await userEvent.click(screen.getByLabelText(t('meeting.modeWindow')));
    await userEvent.type(screen.getByLabelText(t('meeting.start')), '19:30');
    await userEvent.click(screen.getByRole('button', { name: t('meeting.create') }));
    expect(screen.getByText(t('meeting.needTimes'))).toBeInTheDocument();
    expect(createMeeting).not.toHaveBeenCalled();
  });

  it('leader only sees their own groups', () => {
    renderAs('u_lead', ['leader']);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('青年小组');
    expect(options).not.toContain('妇女小组');
  });

  it('creates an always-valid event', async () => {
    renderAs('u_admin', ['admin']);
    await userEvent.type(screen.getByLabelText(t('meeting.title')), '聚餐');
    await userEvent.selectOptions(screen.getByLabelText(t('meeting.type')), 'event');
    await userEvent.click(screen.getByRole('button', { name: t('meeting.create') }));
    expect(createMeeting).toHaveBeenCalledWith(expect.objectContaining({ title: '聚餐', type: 'event', checkinMode: 'always', createdBy: 'u_admin' }));
  });
});
