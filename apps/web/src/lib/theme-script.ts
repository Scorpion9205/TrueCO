// Shared with the server layout, so no 'use client' here

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = 'vargly-theme';
/** The product's look is light; dark is a choice */
export const DEFAULT_THEME: Theme = 'light';

/**
 * Runs in <head> before the page paints, so a dark choice never flashes light first. Kept as a
 * string: it must work before any bundle loads. Storage can be blocked (private mode), hence try.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'${DEFAULT_THEME}';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
