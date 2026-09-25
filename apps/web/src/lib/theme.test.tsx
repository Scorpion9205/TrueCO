import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, useTheme } from './theme';
import { THEME_SCRIPT, THEME_STORAGE_KEY } from './theme-script';

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  mockSystemDark(false);
});
afterEach(() => vi.unstubAllGlobals());

describe('theme', () => {
  it('starts light, as the product is designed', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('light');
  });

  it('switches to dark and remembers it', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('follows the device when set to system', () => {
    mockSystemDark(true);
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    mockSystemDark(false);
    applyTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies the saved choice before the app loads', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    new Function(THEME_SCRIPT)();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
