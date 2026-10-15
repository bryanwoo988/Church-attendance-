import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const signInWithPhoneNumber = vi.fn();
vi.mock('firebase/auth', () => ({
  signInWithPhoneNumber: (...a: unknown[]) => signInWithPhoneNumber(...a),
  RecaptchaVerifier: class { clear() {} render() { return Promise.resolve(0); } },
}));
vi.mock('../firebase', () => ({ auth: {} }));

import LoginPage from './LoginPage';
import { setLang, t } from '../i18n';

beforeEach(() => {
  setLang('zh');
  signInWithPhoneNumber.mockReset();
  signInWithPhoneNumber.mockResolvedValue({ confirm: vi.fn() });
});

describe('LoginPage', () => {
  it('shows an error for an invalid phone and does not send SMS', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(t('login.phone')), '12345');
    await userEvent.click(screen.getByRole('button', { name: t('login.sendCode') }));
    expect(screen.getByText(t('login.invalidPhone'))).toBeInTheDocument();
    expect(signInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it('sends SMS to the normalized number', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(t('login.phone')), '012-345 6789');
    await userEvent.click(screen.getByRole('button', { name: t('login.sendCode') }));
    expect(signInWithPhoneNumber).toHaveBeenCalledWith(expect.anything(), '+60123456789', expect.anything());
    expect(await screen.findByLabelText(t('login.code'))).toBeInTheDocument();
  });
});
