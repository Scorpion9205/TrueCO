'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { DEFAULT_THEME, type Theme, THEME_STORAGE_KEY, THEMES } from './theme-script';

export { THEMES, type Theme };

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (THEMES as readonly string[]).includes(stored ?? '') ? (stored as Theme) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Puts the theme on <html>: the `.dark` class drives the colour tokens in globals.css */
export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Follow the system while "system" is chosen, and choices made in other tabs
  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const onSystem = () => {
    if (readTheme() === 'system') applyTheme('system');
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(readTheme());
    listener();
  };
  media?.addEventListener('change', onSystem);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', onSystem);
    window.removeEventListener('storage', onStorage);
  };
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not remembered, but still applied for this page
    }
    applyTheme(next);
    listeners.forEach((listener) => listener());
  }, []);
  return [theme, setTheme];
}
