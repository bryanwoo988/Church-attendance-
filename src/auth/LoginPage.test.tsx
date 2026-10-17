import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const signInWithCustomToken = vi.fn();
vi.mock('firebase/auth', () => ({ signInWithCustomToken: (...a: unknown[]) => signInWithCustomToken(...a) }));
const call = vi.fn();
vi.mock('../firebase', () => ({ auth: {}, call: (...a: unknown[]) => call(...a) }));

import LoginPage from './LoginPage';
import { setLang, t } from '../i18n';

beforeEach(() => {
  setLang('zh');
  signInWithCustomToken.mockReset().mockResolvedValue({});
  call.mockReset().mockImplementation(async (name: string) => (name === 'requestLoginCode' ? { sent: true } : { token: 'tok', uid: 'u1' }));
});

async function sendTo(phone: string) {
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  await userEvent.type(screen.getByLabelText(t('login.phone')), phone);
  await userEvent.click(screen.getByRole('button', { name: t('login.sendCode') }));
}

describe('LoginPage', () => {
  it('shows an error for an invalid phone and does not send a code', async () => {
    await sendTo('12345');
    expect(screen.getByText(t('login.invalidPhone'))).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  it('asks the server to text the normalized number, then signs in with the returned token', async () => {
    await sendTo('012-345 6789');
    expect(call).toHaveBeenCalledWith('requestLoginCode', { phone: '+60123456789' });
    await userEvent.type(await screen.findByLabelText(t('login.code')), '123456');
    await userEvent.click(screen.getByRole('button', { name: t('login.verify') }));
    expect(call).toHaveBeenCalledWith('verifyLoginCode', { phone: '+60123456789', code: '123456' });
    expect(signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'tok');
  });

  it('explains a wrong code', async () => {
    await sendTo('012-345 6789');
    call.mockRejectedValue({ code: 'functions/invalid-argument', message: 'login.wrongCode' });
    await userEvent.type(await screen.findByLabelText(t('login.code')), '000000');
    await userEvent.click(screen.getByRole('button', { name: t('login.verify') }));
    expect(await screen.findByText(t('login.wrongCode'))).toBeInTheDocument();
    expect(signInWithCustomToken).not.toHaveBeenCalled();
  });

  it('explains the daily limit', async () => {
    call.mockRejectedValue({ code: 'functions/resource-exhausted', message: 'login.tooMany' });
    await sendTo('011-4001 5077');
    expect(await screen.findByText(t('login.tooMany'))).toBeInTheDocument();
  });

  it('shows the error code for an unexpected failure', async () => {
    call.mockRejectedValue({ code: 'functions/internal', message: 'INTERNAL' });
    await sendTo('011-4001 5077');
    expect(await screen.findByText(/functions\/internal/)).toBeInTheDocument();
  });

  it('shows the Twilio error code when the provider refuses to send', async () => {
    call.mockRejectedValue({ code: 'functions/failed-precondition', message: 'login.sendFailed', details: { twilio: 21408 } });
    await sendTo('012-848 9771');
    expect(await screen.findByText(t('login.sendFailed'))).toBeInTheDocument();
    expect(screen.getByText(/Twilio 21408/)).toBeInTheDocument();
  });

  it('shows the Twilio code when fraud protection blocks a number', async () => {
    call.mockRejectedValue({ code: 'functions/permission-denied', message: 'login.blocked [403]', details: { twilio: 60410 } });
    await sendTo('011-4001 5077');
    expect(await screen.findByText(t('login.blocked'))).toBeInTheDocument();
    expect(screen.getByText(/Twilio 60410/)).toBeInTheDocument();
  });
});
