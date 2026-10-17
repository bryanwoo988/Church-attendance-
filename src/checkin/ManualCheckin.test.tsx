import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Person } from '../../shared/types';

const call = vi.fn();
vi.mock('../firebase', () => ({ call: (...a: unknown[]) => call(...a), db: {}, auth: {} }));
const P = (id: string, name: string, phone?: string, active = true): Person => ({ id, name, phone, kind: 'adult', householdId: 'h', status: 'member', active, visitCount: 0, createdAt: new Date() });
vi.mock('../api', () => ({ usePeople: () => [P('p1', 'Mary Tan', '+60123456789'), P('p2', 'John Lee'), P('p3', 'Mary Gone', undefined, false)] }));

import ManualCheckin from './ManualCheckin';
import { t, setLang } from '../i18n';

const onPick = vi.fn();
const onAdded = vi.fn();
beforeEach(() => {
  setLang('zh');
  call.mockReset();
  onPick.mockReset();
  onAdded.mockReset();
});

const renderIt = () => render(<ManualCheckin meetingId="m1" onPick={onPick} onAdded={onAdded} onClose={() => {}} />);

describe('ManualCheckin', () => {
  it('finds active people by name and checks them in', async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText(t('manual.search')), 'mary');
    expect(screen.queryByText('Mary Gone')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mary Tan/ }));
    expect(onPick).toHaveBeenCalledWith('p1', 'Mary Tan');
  });

  it('finds people by phone digits', async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText(t('manual.search')), '012-345');
    expect(screen.getByRole('button', { name: /Mary Tan/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /John Lee/ })).not.toBeInTheDocument();
  });

  it('adds a newcomer with the searched name', async () => {
    call.mockResolvedValue({ personId: 'new', status: 'ok', created: true });
    renderIt();
    await userEvent.type(screen.getByLabelText(t('manual.search')), 'Ah Kow');
    expect(screen.getByText(t('manual.none'))).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(t('manual.phone')), '0128887777');
    await userEvent.click(screen.getByRole('button', { name: t('manual.add') }));
    expect(call).toHaveBeenCalledWith('scannerAddVisitor', { meetingId: 'm1', name: 'Ah Kow', phone: '0128887777', kind: 'adult' });
    expect(onAdded).toHaveBeenCalledWith('Ah Kow', 'ok');
  });

  it('shows the server message for a bad phone', async () => {
    call.mockRejectedValue({ code: 'functions/invalid-argument', message: 'welcome.invalidPhone' });
    renderIt();
    await userEvent.type(screen.getByLabelText(t('manual.search')), 'Ah Kow');
    await userEvent.type(screen.getByLabelText(t('manual.phone')), '123');
    await userEvent.click(screen.getByRole('button', { name: t('manual.add') }));
    expect(await screen.findByText(t('login.invalidPhone'))).toBeInTheDocument();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
