import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppUpdated } from './useAppUpdated';

function fakeSw(controller: object | null) {
  const target = new EventTarget();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: Object.assign(target, { controller, getRegistration: async () => undefined }),
  });
  return target;
}

afterEach(() => { delete (navigator as { serviceWorker?: unknown }).serviceWorker; });

describe('useAppUpdated', () => {
  it('flags an update when a new service worker takes over a running page', () => {
    const sw = fakeSw({});
    const { result } = renderHook(() => useAppUpdated());
    expect(result.current).toBe(false);
    act(() => { sw.dispatchEvent(new Event('controllerchange')); });
    expect(result.current).toBe(true);
  });

  it('ignores the very first install', () => {
    const sw = fakeSw(null);
    const { result } = renderHook(() => useAppUpdated());
    act(() => { sw.dispatchEvent(new Event('controllerchange')); });
    expect(result.current).toBe(false);
  });
});
