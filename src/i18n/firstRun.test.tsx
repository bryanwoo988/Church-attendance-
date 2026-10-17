import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('first-run language', () => {
  it('defaults to English and asks first-time users to choose', async () => {
    const i18n = await import('./index');
    expect(i18n.getLang()).toBe('en');
    expect(i18n.hasChosenLang()).toBe(false);
  });

  it('remembers the choice', async () => {
    localStorage.setItem('lang', 'zh');
    const i18n = await import('./index');
    expect(i18n.getLang()).toBe('zh');
    expect(i18n.hasChosenLang()).toBe(true);
  });

  it('the picker saves the chosen language', async () => {
    const i18n = await import('./index');
    const { default: LanguagePicker } = await import('./LanguagePicker');
    render(<LanguagePicker />);
    await userEvent.click(screen.getByRole('button', { name: '中文' }));
    expect(i18n.getLang()).toBe('zh');
    expect(i18n.hasChosenLang()).toBe(true);
    expect(localStorage.getItem('lang')).toBe('zh');
  });
});
