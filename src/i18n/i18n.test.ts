import { describe, it, expect, vi, beforeEach } from 'vitest';
import { t, setLang, getLang } from './index';

describe('i18n', () => {
  beforeEach(() => setLang('zh'));

  it('returns Chinese title by default', () => {
    expect(t('app.title')).toBe('教会签到');
  });

  it('returns English title after switching', () => {
    setLang('en');
    expect(t('app.title')).toBe('Church Check-in');
  });

  it('interpolates variables', () => {
    setLang('en');
    expect(t('greeting', { name: 'Mary' })).toBe('Hello, Mary');
  });

  it('keeps working when localStorage throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => setLang('en')).not.toThrow();
    expect(getLang()).toBe('en');
    get.mockRestore(); set.mockRestore();
  });
});
