// ==========================================
// Vargly Design System Tokens & Aesthetics
// ==========================================

export const tokens = {
  colors: {
    // Brand orange. 500 is the vivid accent; 600 is the button/link shade (white text passes WCAG AA).
    primary: {
      50: '#fff3ed',
      100: '#ffe4d5',
      500: '#f26b3a',
      600: '#cf4a12',
      700: '#b53f0f',
      900: '#6b2508',
    },
    accent: {
      500: '#2563eb',
      600: '#1d4ed8',
      700: '#1e40af',
    },
    surface: {
      dark: '#0a0a0a',
      darkCard: '#141413',
      darkBorder: '#292524',
      light: '#ffffff',
      lightCard: '#ffffff',
      lightBorder: '#e7e5e4',
    },
    status: {
      success: '#15803d',
      warning: '#b45309',
      danger: '#b91c1c',
      info: '#2563eb',
      whatsapp: '#1c9e57',
    },
  },
  typography: {
    fontFamily: {
      sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  shadows: {
    card: '0 1px 2px rgb(10 10 10 / 0.04), 0 8px 24px -12px rgb(10 10 10 / 0.12)',
    float: '0 12px 40px -12px rgb(10 10 10 / 0.18)',
  },
} as const;

export type DesignTokens = typeof tokens;
