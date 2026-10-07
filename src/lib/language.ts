'use client';

import { useSyncExternalStore } from 'react';

/** The console's language, chosen in its menu and remembered on this browser. Spanish by default. */
const KEY = 'gatopago.business.lang';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'en';
  } catch {
    return false;
  }
}

export function useEnglish(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => false,
  );
}

export function setEnglish(en: boolean) {
  try {
    localStorage.setItem(KEY, en ? 'en' : 'es');
  } catch {
    // Private mode: the choice lasts for this page.
  }
  document.documentElement.lang = en ? 'en' : 'es';
  listeners.forEach((listener) => listener());
}
