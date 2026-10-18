import { useSyncExternalStore } from 'react';
import { t } from '../i18n';

export type ToastKind = 'ok' | 'err' | 'info';
export interface Toast { id: number; kind: ToastKind; title: string; body?: string }

const SHOW_MS = 3500;
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Show a banner at the top of the screen; it closes itself after a few seconds. */
export function toast(t: Omit<Toast, 'id'>): void {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { ...t, id }];
  emit();
  setTimeout(() => dismiss(id), t.kind === 'err' ? SHOW_MS * 2 : SHOW_MS);
}

export function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function dismissAll(): void {
  toasts = [];
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => toasts,
  );
}

/** The standard "something failed" banner, with what to do next. */
export function toastError(): void {
  toast({ kind: 'err', title: t('ui.errorTitle'), body: t('ui.errorBody') });
}
