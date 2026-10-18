import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toCanvas = vi.fn().mockResolvedValue(undefined);
const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,AAAA');
vi.mock('qrcode', () => ({ default: { toCanvas: (...a: unknown[]) => toCanvas(...a), toDataURL: (...a: unknown[]) => toDataURL(...a) } }));
const haptic = vi.fn();
vi.mock('../ui/haptic', () => ({ haptic: (...a: unknown[]) => haptic(...a) }));

import QrCard from './QrCard';
import { t, setLang } from '../i18n';

beforeEach(() => { setLang('zh'); haptic.mockClear(); });

describe('QrCard', () => {
  it('encodes the personal payload and shows the name', async () => {
    render(<QrCard personId="abc123" name="Mary Tan" />);
    await waitFor(() => expect(toCanvas).toHaveBeenCalledWith(expect.anything(), 'cqr:p:abc123', expect.objectContaining({ errorCorrectionLevel: 'M' })));
    expect(screen.getByText('Mary Tan')).toBeInTheDocument();
  });

  it('pops up a large code with a buzz, offering download, and closes', async () => {
    render(<QrCard personId="abc123" name="Mary Tan" />);
    await userEvent.click(screen.getByRole('button', { name: /Mary Tan/ }));
    expect(haptic).toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Mary Tan' });
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Mary Tan' })).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.getByRole('button', { name: t('qr.download') })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
