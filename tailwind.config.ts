import type { Config } from 'tailwindcss'
import { brand, fontFamily, macros, neutral, semantic, surface, surfaceDark, typeScale } from './src/theme/tokens'

function fontSizeEntry(t: { fontSize: string; fontWeight: string; lineHeight: string }): [string, { lineHeight: string; fontWeight: string }] {
  return [t.fontSize, { lineHeight: t.lineHeight, fontWeight: t.fontWeight }]
}

/**
 * Phase F.1: `brand.400`/`brand.600` and `surfaceDark.bg`/`.card` are the
 * only rungs the Contrast theme changes (deeper background, brighter
 * accent — see `contrastDark` in tokens.ts). Everywhere else in the app
 * that imports `brand`/`surfaceDark` directly from tokens.ts still gets
 * the plain, real hex values — this CSS-variable indirection is scoped to
 * Tailwind's compiled classes only, via a local copy, so no other consumer
 * is affected. The `var(..., fallback)` form means these classes still
 * render correctly even if `index.css`'s `:root` block is ever missing.
 */
const tailwindBrand = { ...brand, 400: 'var(--brand-400, ' + brand[400] + ')', 600: 'var(--brand-600, ' + brand[600] + ')' }
const tailwindSurfaceDark = {
  DEFAULT: 'var(--surface-dark-bg, ' + surfaceDark.bg + ')',
  card: 'var(--surface-dark-card, ' + surfaceDark.card + ')',
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [...fontFamily.sans],
        mono: [...fontFamily.mono],
      },
      colors: {
        brand: tailwindBrand,
        // protein reuses the brand hue (tailwindBrand, not macros.protein
        // directly) so it picks up Contrast's brighter accent too.
        protein: tailwindBrand,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        // success also reuses the brand hue — same reasoning as protein above.
        success: tailwindBrand,
        warn: semantic.warn,
        over: semantic.over,
        danger: semantic.danger,
        slate: neutral,
        surface: {
          DEFAULT: surface.bg,
          card: surface.card,
        },
        'surface-dark': tailwindSurfaceDark,
      },
      fontSize: {
        display: fontSizeEntry(typeScale.display),
        title: fontSizeEntry(typeScale.title),
        body: fontSizeEntry(typeScale.body),
        caption: fontSizeEntry(typeScale.caption),
        tag: fontSizeEntry(typeScale.tag),
      },
      borderRadius: {
        card: surface.radiusCard,
      },
      boxShadow: {
        card: surface.shadowCard,
        'card-dark': surfaceDark.shadowCard,
      },
      spacing: {
        18: '4.5rem', // 72px — leaves room for the bottom tab bar
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config
