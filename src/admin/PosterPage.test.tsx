import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn().mockResolvedValue(undefined) } }));
import PosterPage from './PosterPage';
import { t, setLang } from '../i18n';

describe('PosterPage', () => {
  it('tells phone users how to print', () => {
    setLang('zh');
    render(<MemoryRouter><PosterPage /></MemoryRouter>);
    expect(screen.getByText(t('poster.phoneHint'))).toBeInTheDocument();
  });
});
