// Design tokens for the Recon product system — single source of truth for color/radius/spacing/shadow.
// A Tailwind preset will re-export these once Tailwind is installed (Phase 2).

export const colors = {
  background: '#F6F6F2',
  surface: '#FFFFFF',
  surfaceElevated: '#ECECE6',
  border: '#D8D9D2',
  textPrimary: '#171815',
  textSecondary: '#65675F',
  accent: '#F0523D',
  accentContrast: '#FFFFFF',
  success: '#087F6D',
  warning: '#B66A0A',
  danger: '#C7352A',
  neutral: '#777A71',
} as const;

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '8px',
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
  card: '0 1px 2px rgba(35,37,31,0.08), 0 8px 24px rgba(35,37,31,0.06)',
  elevated: '0 4px 12px rgba(35,37,31,0.1), 0 16px 40px rgba(35,37,31,0.12)',
} as const;

export const typography = {
  fontFamily: '"Manrope Variable", sans-serif',
  amount: { weight: 700, tabularNums: true },
} as const;
