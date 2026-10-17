import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const verifyPhoneNumber = vi.fn();
const updatePhoneNumber = vi.fn();
const getIdToken = vi.fn().mockResolvedValue('t');
vi.mock('firebase/auth', () => ({
  RecaptchaVerifier: class { clear() {} },
  PhoneAuthProvider: Object.assign(
    class { verifyPhoneNumber(...a: unknown[]) { return verifyPhoneNumber(...a); } },
    { credential: (id: string, code: string) => ({ id, code }) },
  ),
  updatePhoneNumber: (...a: unknown[]) => updatePhoneNumber(...a),
}));
const call = vi.fn();
vi.mock('../firebase', () => ({ auth: { currentUser: { getIdToken: (...a: unknown[]) => getIdToken(...a) } }, call: (...a: unknown[]) => call(...a) }));

import ChangePhone from './ChangePhone';
import { t, setLang } from '../i18n';

beforeEach(() => {
  setLang('zh');
  verifyPhoneNumber.mockReset().mockResolvedValue('vid');
  updatePhoneNumber.mockReset().mockResolvedValue(undefined);
  call.mockReset().mockResolvedValue({ phone: '+60177654321', merged: 0 });
});

async function sendTo(phone: string) {
  render(<ChangePhone current="+60123456789" />);
  await userEvent.type(screen.getByLabelText(t('phone.new')), phone);
  await userEvent.click(screen.getByRole('button', { name: t('login.sendCode') }));
}

describe('ChangePhone', () => {
  it('rejects an invalid number without sending SMS', async () => {
    await sendTo('12345');
    expect(screen.getByText(t('login.invalidPhone'))).toBeInTheDocument();
    expect(verifyPhoneNumber).not.toHaveBeenCalled();
  });

  it('rejects the same number as now', async () => {
    await sendTo('012-345 6789');
    expect(screen.getByText(t('phone.same'))).toBeInTheDocument();
    expect(verifyPhoneNumber).not.toHaveBeenCalled();
  });

  it('verifies by SMS, updates the account, then syncs the record', async () => {
    await sendTo('017-765 4321');
    expect(verifyPhoneNumber).toHaveBeenCalledWith('+60177654321', expect.anything());
    await userEvent.type(await screen.findByLabelText(t('login.code')), '654321');
    await userEvent.click(screen.getByRole('button', { name: t('phone.confirm') }));
    expect(updatePhoneNumber).toHaveBeenCalledWith(expect.anything(), { id: 'vid', code: '654321' });
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(call).toHaveBeenCalledWith('syncMyPhone', {});
    expect(await screen.findByText(t('phone.done', { phone: '+60177654321' }))).toBeInTheDocument();
  });

  it('explains when the number belongs to another account', async () => {
    updatePhoneNumber.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    await sendTo('017-765 4321');
    await userEvent.type(await screen.findByLabelText(t('login.code')), '654321');
    await userEvent.click(screen.getByRole('button', { name: t('phone.confirm') }));
    expect(await screen.findByText(t('phone.inUse'))).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });
});
