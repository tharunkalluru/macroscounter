import type { Config } from 'tailwindcss'
import { brand, macros, neutral, semantic, surface, surfaceDark, typeScale } from './src/theme/tokens'

function fontSizeEntry(t: { fontSize: string; fontWeight: string; lineHeight: string }): [string, { lineHeight: string; fontWeight: string }] {
  return [t.fontSize, { lineHeight: t.lineHeight, fontWeight: t.fontWeight }]
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        success: semantic.success,
        warn: semantic.warn,
        danger: semantic.danger,
        slate: neutral,
        surface: {
          DEFAULT: surface.bg,
          card: surface.card,
        },
        'surface-dark': {
          DEFAULT: surfaceDark.bg,
          card: surfaceDark.card,
        },
      },
      fontSize: {
        display: fontSizeEntry(typeScale.display),
        title: fontSizeEntry(typeScale.title),
        body: fontSizeEntry(typeScale.body),
        caption: fontSizeEntry(typeScale.caption),
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
