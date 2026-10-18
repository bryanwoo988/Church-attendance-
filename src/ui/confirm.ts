import { useSyncExternalStore } from 'react';

export interface ConfirmOptions { title: string; body?: string; confirmLabel?: string; danger?: boolean }
interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/**
 * Ask inside the app (a bottom sheet). The browser's confirm() can be silently suppressed in
 * installed PWAs, which made buttons look dead.
 */
export function confirmSheet(opts: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { ...opts, resolve };
    emit();
  });
}

export function answer(ok: boolean): void {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
}

export function usePendingConfirm(): Pending | null {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => pending,
  );
}
