import { useSyncExternalStore } from 'react';
import { zh, type MessageKey } from './zh';
import { en } from './en';

export type Lang = 'zh' | 'en';
export type { MessageKey };

const dicts: Record<Lang, Record<MessageKey, string>> = { zh, en };
const listeners = new Set<() => void>();

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem('lang');
    return v === 'en' || v === 'zh' ? v : null;
  } catch {
    return null;
  }
}

const stored = readStored();
// English unless the person has picked a language; first-time users are asked to choose.
let current: Lang = stored ?? 'en';
let chosen = stored !== null;
if (typeof document !== 'undefined') document.documentElement.lang = current === 'zh' ? 'zh-Hans' : 'en';

export function getLang(): Lang {
  return current;
}

export function hasChosenLang(): boolean {
  return chosen;
}

export function setLang(l: Lang): void {
  current = l;
  chosen = true;
  try {
    localStorage.setItem('lang', l);
  } catch {
    // storage blocked: keep the choice in memory only
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'zh' ? 'zh-Hans' : 'en';
  listeners.forEach((fn) => fn());
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useT() {
  const lang = useSyncExternalStore(subscribe, getLang);
  return { t, lang, setLang };
}

/** True once the person has picked a language (re-renders when they do). */
export function useLangChosen(): boolean {
  return useSyncExternalStore(subscribe, hasChosenLang);
}
