// ==========================================
// TrueCO Design System Tokens & Aesthetics
// ==========================================

export const tokens = {
  colors: {
    primary: {
      50: '#ecfdf5',
      100: '#d1fae5',
      500: '#10b981', // Emerald WhatsApp Brand Accent
      600: '#059669',
      700: '#047857',
      900: '#064e3b',
    },
    accent: {
      500: '#6366f1', // Indigo modern accent
      600: '#4f46e5',
      700: '#4338ca',
    },
    surface: {
      dark: '#0b0f17',
      darkCard: '#131b2e',
      darkBorder: '#1e293b',
      light: '#f8fafc',
      lightCard: '#ffffff',
      lightBorder: '#e2e8f0',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
    },
  },
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
  },
  shadows: {
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  glassmorphism: {
    backdropBlur: 'blur(12px)',
    background: 'rgba(19, 27, 46, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
} as const;

export type DesignTokens = typeof tokens;
