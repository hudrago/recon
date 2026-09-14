// Design tokens for the Revolut-inspired system — single source of truth for color/radius/spacing/shadow.
// A Tailwind preset will re-export these once Tailwind is installed (Phase 2).

export const colors = {
  background: '#0B0B0F',
  surface: '#15151B',
  surfaceElevated: '#1E1E26',
  border: '#2A2A33',
  textPrimary: '#FFFFFF',
  textSecondary: '#9A9AA6',
  accent: '#6D5CFF',
  accentContrast: '#FFFFFF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  neutral: '#6B7280',
} as const;

export const radius = {
  sm: '8px',
  md: '12px',
  lg: '20px',
  pill: '999px',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const shadow = {
  card: '0 1px 2px rgba(0,0,0,0.24), 0 8px 24px rgba(0,0,0,0.16)',
  elevated: '0 4px 12px rgba(0,0,0,0.3), 0 16px 40px rgba(0,0,0,0.2)',
} as const;

export const typography = {
  fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
  amount: { weight: 700, tabularNums: true },
} as const;
