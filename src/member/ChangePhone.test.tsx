import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getIdToken = vi.fn().mockResolvedValue('t');
const call = vi.fn();
vi.mock('../firebase', () => ({ auth: { currentUser: { getIdToken: (...a: unknown[]) => getIdToken(...a) } }, call: (...a: unknown[]) => call(...a) }));

import ChangePhone from './ChangePhone';
import { t, setLang } from '../i18n';

beforeEach(() => {
  setLang('zh');
  getIdToken.mockClear();
  call.mockReset().mockImplementation(async (name: string) => (name === 'requestPhoneChangeCode' ? { sent: true } : { phone: '+60177654321', merged: 0 }));
});

async function sendTo(phone: string) {
  render(<ChangePhone current="+60123456789" />);
  await userEvent.type(screen.getByLabelText(t('phone.new')), phone);
  await userEvent.click(screen.getByRole('button', { name: t('login.sendCode') }));
}

describe('ChangePhone', () => {
  it('rejects an invalid number without sending a code', async () => {
    await sendTo('12345');
    expect(screen.getByText(t('login.invalidPhone'))).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  it('rejects the same number as now', async () => {
    await sendTo('012-345 6789');
    expect(screen.getByText(t('phone.same'))).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  it('texts a code to the new number and confirms the change on the server', async () => {
    await sendTo('017-765 4321');
    expect(call).toHaveBeenCalledWith('requestPhoneChangeCode', { phone: '+60177654321' });
    await userEvent.type(await screen.findByLabelText(t('login.code')), '654321');
    await userEvent.click(screen.getByRole('button', { name: t('phone.confirm') }));
    expect(call).toHaveBeenCalledWith('confirmPhoneChange', { phone: '+60177654321', code: '654321' });
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(await screen.findByText(t('phone.done', { phone: '+60177654321' }))).toBeInTheDocument();
  });

  it('explains when the number belongs to another account', async () => {
    await sendTo('017-765 4321');
    call.mockRejectedValue({ code: 'functions/failed-precondition', message: 'phone.inUse' });
    await userEvent.type(await screen.findByLabelText(t('login.code')), '654321');
    await userEvent.click(screen.getByRole('button', { name: t('phone.confirm') }));
    expect(await screen.findByText(t('phone.inUse'))).toBeInTheDocument();
  });
});
