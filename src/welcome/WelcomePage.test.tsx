import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const call = vi.fn();
vi.mock('../firebase', () => ({ call: (...a: unknown[]) => call(...a) }));

import WelcomePage from './WelcomePage';
import { t, setLang } from '../i18n';

beforeEach(() => { setLang('zh'); call.mockReset(); });

const renderPage = () => render(<MemoryRouter><WelcomePage /></MemoryRouter>);

async function fillRequired() {
  await userEvent.type(screen.getByLabelText(t('welcome.name')), 'Ah Kow');
  await userEvent.type(screen.getByLabelText(t('welcome.phone')), '012-345 6789');
}

describe('WelcomePage', () => {
  it('keeps submit disabled until PDPA consent is ticked', async () => {
    renderPage();
    await fillRequired();
    const submit = screen.getByRole('button', { name: t('welcome.submit') });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByLabelText(t('welcome.pdpaAgree')));
    expect(submit).toBeEnabled();
  });

  it('shows an invalid phone message', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(t('welcome.name')), 'Ah Kow');
    await userEvent.type(screen.getByLabelText(t('welcome.phone')), '12345');
    await userEvent.click(screen.getByLabelText(t('welcome.pdpaAgree')));
    await userEvent.click(screen.getByRole('button', { name: t('welcome.submit') }));
    expect(screen.getByText(t('login.invalidPhone'))).toBeInTheDocument();
    expect(call).not.toHaveBeenCalled();
  });

  it('submits the normalized phone and shows the visit number', async () => {
    call.mockResolvedValue({ personId: 'p', visitNumber: 2, checkedIn: true });
    renderPage();
    await fillRequired();
    await userEvent.click(screen.getByLabelText(t('welcome.pdpaAgree')));
    await userEvent.click(screen.getByRole('button', { name: t('welcome.submit') }));
    expect(call).toHaveBeenCalledWith('submitVisitorForm', expect.objectContaining({ name: 'Ah Kow', phone: '+60123456789', pdpaConsent: true, contactConsent: false, familyNames: [] }));
    expect(await screen.findByText(t('welcome.visitN', { n: 2 }))).toBeInTheDocument();
  });
});
