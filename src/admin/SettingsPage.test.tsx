import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const saveSettings = vi.fn().mockResolvedValue(undefined);
const SETTINGS = { offeringCategories: ['一般奉献 General'], sunday: { weekday: 0, start: '09:00', end: '11:30', checkinMode: 'window' } };
vi.mock('../api', () => ({
  saveSettings: (...a: unknown[]) => saveSettings(...a),
  useSettings: () => SETTINGS,
}));

import SettingsPage from './SettingsPage';
import { t, setLang } from '../i18n';

beforeEach(() => { setLang('zh'); saveSettings.mockClear(); });

describe('SettingsPage', () => {
  it('rejects a payment QR file over 5 MB without saving', async () => {
    render(<SettingsPage />);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'qr.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(t('settings.qrUpload')), { target: { files: [big] } });
    expect(await screen.findByText(t('settings.fileTooLarge'))).toBeInTheDocument();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('rejects a non-image file', async () => {
    render(<SettingsPage />);
    const f = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(t('settings.qrUpload')), { target: { files: [f] } });
    expect(await screen.findByText(t('settings.notImage'))).toBeInTheDocument();
  });

  it('saves the Sunday time', async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText(t('settings.sundayStart')), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: t('settings.saveSunday') }));
    expect(saveSettings).toHaveBeenCalledWith({ sunday: { weekday: 0, start: '10:00', end: '11:30', checkinMode: 'window' } });
  });

  it('saves the daily verification-code limit per number', async () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText(t('settings.otpLimit'));
    expect(input).toHaveValue(30);
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(document.getElementById('otp-save')!);
    expect(saveSettings).toHaveBeenCalledWith({ otpPerPhonePerDay: 10 });
  });
});
