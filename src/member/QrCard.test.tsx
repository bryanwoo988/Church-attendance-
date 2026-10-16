import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const toCanvas = vi.fn().mockResolvedValue(undefined);
vi.mock('qrcode', () => ({ default: { toCanvas: (...a: unknown[]) => toCanvas(...a) } }));

import QrCard from './QrCard';

describe('QrCard', () => {
  it('encodes the personal payload and shows the name', async () => {
    render(<QrCard personId="abc123" name="Mary Tan" />);
    await waitFor(() => expect(toCanvas).toHaveBeenCalledWith(expect.anything(), 'cqr:p:abc123', expect.objectContaining({ errorCorrectionLevel: 'M' })));
    expect(screen.getByText('Mary Tan')).toBeInTheDocument();
  });
});
