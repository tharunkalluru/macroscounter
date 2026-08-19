/**
 * MacroDesi design tokens — single source of truth for color, type, and
 * surface values. `tailwind.config.ts` imports directly from this file (no
 * duplication); components that need raw color values JS can't express via
 * Tailwind classes (SVG `stroke`, Recharts `stroke`/`fill` props) import the
 * specific token instead of hardcoding a hex literal — that's what
 * `npm run check:tokens` enforces (see scripts/check-tokens.ts).
 */

/** brand-600 #0F9D58 family, 50->900. */
export const brand = {
  50: '#F2FDF8',
  100: '#E0FAEE',
  200: '#BCF5DA',
  300: '#8AEFBE',
  400: '#48EA9C',
  500: '#16D478',
  600: '#0F9D58',
  700: '#0C7E47',
  800: '#0B653A',
  900: '#0B502F',
} as const

/**
 * brand-600 itself is only 3.51:1 against white — fine for large/graphical
 * use (ring strokes, active-tab fills, icons) but fails WCAG AA 4.5:1 for
 * text, including white button labels on a brand-600 background. Anywhere
 * text sits on/as brand color, use brand-700 (5.13:1) instead — e.g.
 * `bg-brand-700` for primary buttons, `text-brand-700` for brand-colored
 * headings/links. Verified via the axe-core a11y suite (e2e/a11y.spec.ts).
 */

/** Macro colors — reused identically in ring segments, bars, history, reports. */
export const macros = {
  protein: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },
  carbs: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  fat: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
} as const

/**
 * Macro fill colors (500) are graphical (ring/bar fills) and only need 3:1
 * non-text contrast — fine at 500. Any macro *text* (e.g. a colored label)
 * should use the 700 shade instead (verified >=4.5:1 on white for all three).
 */

/** Semantic bands for calendar days & remaining-kcal states. */
export const semantic = {
  success: brand,
  warn: macros.carbs,
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
} as const

export const neutral = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const

export const surface = {
  bg: '#F8FAF9',
  card: '#FFFFFF',
  radiusCard: '16px',
  shadowCard: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
} as const

/** Dark-mode mirror of `surface` — applied via Tailwind's `dark:` variant. */
export const surfaceDark = {
  bg: '#0B1210',
  card: '#132119',
  radiusCard: '16px',
  shadowCard: '0 1px 2px 0 rgb(0 0 0 / 0.3), 0 1px 3px 0 rgb(0 0 0 / 0.4)',
} as const

/** size(px) / weight / lineHeight. */
export const typeScale = {
  display: { fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
  title: { fontSize: '20px', fontWeight: '600', lineHeight: '1.3' },
  body: { fontSize: '15px', fontWeight: '450', lineHeight: '1.5' },
  caption: { fontSize: '12.5px', fontWeight: '450', lineHeight: '1.4' },
} as const

/** 4px base scale only. */
export const spacingScale = { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px' } as const

export const touchTarget = { minPx: 44 } as const

export const motion = {
  screenTransitionMs: 200,
  ringSweepMs: 450,
  countUpMs: 300,
  ringEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const
