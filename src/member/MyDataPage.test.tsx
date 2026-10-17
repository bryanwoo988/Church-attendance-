import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const call = vi.fn().mockResolvedValue({ ok: true });
vi.mock('../firebase', () => ({ call: (...a: unknown[]) => call(...a), auth: {}, db: {} }));
vi.mock('../api', () => ({
  useHousehold: () => [{ id: 'p1', name: 'Mary', kind: 'adult', householdId: 'h1', status: 'member', phone: '+60123456789', active: true, visitCount: 0, createdAt: new Date() }],
  useHouseholdAttendance: () => attendance,
  useGroups: () => [{ id: 'g1', name: '青年小组', leaderUids: [], memberPersonIds: [] }],
  useMeetingsByIds: () => meetings,
}));
let attendance: unknown[] = [];
let meetings: unknown[] = [];

import { AuthContext } from '../auth/AuthProvider';
import MyDataPage from './MyDataPage';
import { t } from '../i18n';

function renderPage(signOut = vi.fn().mockResolvedValue(undefined)) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ status: 'ready', uid: 'u1', roles: [], signOut, user: { uid: 'u1', personId: 'p1', householdId: 'h1', roles: [] } }}>
        <MyDataPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('MyDataPage', () => {
  it('shows each record with meeting type, group or title, time and method', () => {
    meetings = [
      { id: 's1', type: 'sunday', title: '主日', date: '2026-10-18', checkinMode: 'always' },
      { id: 'gm', type: 'group', title: '周五查经', date: '2026-10-16', groupId: 'g1', checkinMode: 'always' },
      { id: 'ev', type: 'event', title: '圣诞晚会', date: '2026-12-24', checkinMode: 'always' },
    ];
    attendance = [
      { meetingId: 's1', personId: 'p1', date: '2026-10-18', method: 'scanner', at: new Date('2026-10-18T01:05:00Z') },
      { meetingId: 'gm', personId: 'p1', date: '2026-10-16', method: 'self', at: new Date('2026-10-16T12:30:00Z') },
      { meetingId: 'ev', personId: 'p1', date: '2026-12-24', method: 'visitorForm', at: new Date('2026-12-24T11:00:00Z') },
    ];
    renderPage();
    expect(screen.getByText(`${t('rec.sunday')} · 2026-10-18`)).toBeInTheDocument();
    expect(screen.getByText(`${t('rec.group')} · 青年小组 · 周五查经`)).toBeInTheDocument();
    expect(screen.getByText(`${t('rec.event')} · 圣诞晚会`)).toBeInTheDocument();
    expect(screen.getByText('2026-10-18 09:05')).toBeInTheDocument();
    expect(screen.getByText(`Mary · ${t('method.self')}`)).toBeInTheDocument();
    attendance = [];
    meetings = [];
  });

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
