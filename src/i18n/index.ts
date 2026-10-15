import { useSyncExternalStore } from 'react';
import { zh, type MessageKey } from './zh';
import { en } from './en';

export type Lang = 'zh' | 'en';
export type { MessageKey };

const dicts: Record<Lang, Record<MessageKey, string>> = { zh, en };
const listeners = new Set<() => void>();

function readStored(): Lang {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

let current: Lang = readStored();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  current = l;
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
