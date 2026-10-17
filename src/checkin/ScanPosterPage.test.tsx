import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

let decode: (text: string) => void = () => {};
vi.mock('./CameraScanner', () => ({
  default: ({ onDecode }: { onDecode: (t: string) => void }) => {
    decode = onDecode;
    return null;
  },
}));

let settings: { selfCheckin?: boolean } = { selfCheckin: true };
vi.mock('../api', () => ({ useSettings: () => settings }));

import ScanPosterPage from './ScanPosterPage';
import { t, setLang } from '../i18n';

function Where() {
  const l = useLocation();
  return <p>at:{l.pathname + l.search}</p>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/scan-poster']}>
      <Routes>
        <Route path="/scan-poster" element={<ScanPosterPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { setLang('zh'); settings = { selfCheckin: true }; });

describe('ScanPosterPage', () => {
  it('opens check-in for the meeting on a scanned church poster', () => {
    renderPage();
    act(() => decode(`${window.location.origin}/checkin?m=g1`));
    expect(screen.getByText('at:/checkin?m=g1')).toBeInTheDocument();
  });

  it('rejects a QR code that is not a church poster', () => {
    renderPage();
    act(() => decode('https://evil.example/checkin'));
    expect(screen.getByText(t('posterScan.notPoster'))).toBeInTheDocument();
  });

  it('offers checking in without scanning', () => {
    renderPage();
    expect(screen.getByRole('link', { name: t('posterScan.skip') })).toHaveAttribute('href', '/checkin');
  });

  it('tells members to use the door scanner when self check-in is off', () => {
    settings = { selfCheckin: false };
    renderPage();
    expect(screen.getByText(t('checkin.selfOff'))).toBeInTheDocument();
  });
});
