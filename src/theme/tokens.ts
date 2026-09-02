/**
 * Bitewise design tokens — single source of truth for color, type, and
 * surface values. `tailwind.config.ts` imports directly from this file (no
 * duplication); components that need raw color values JS can't express via
 * Tailwind classes (SVG `stroke`, Recharts `stroke`/`fill` props) import the
 * specific token instead of hardcoding a hex literal — that's what
 * `npm run check:tokens` enforces (see scripts/check-tokens.ts).
 *
 * Nocturne redesign (Phase R.0): every ramp below was regenerated at the
 * new hue but deliberately keeps the *same per-rung WCAG contract* the old
 * palette had, since ~50+ components reference specific rungs directly
 * (e.g. `text-slate-500 dark:text-slate-400`) without knowing which
 * palette is active. The contract, verified via a relative-luminance
 * script against these exact backgrounds (not just eyeballed):
 *   - rung 400 >= 4.5:1 against the dark surfaces (`surfaceDark.bg`/`card`)
 *     *and* against `neutral-700` (a raised dark chip/pill background, e.g.
 *     `SegmentedControl`'s selected-pill state) — the rung `dark:text-*-400`
 *     usages rely on either.
 *   - rung 500 >= 4.5:1 against white — light-mode default secondary/body
 *     text (`text-slate-500` etc.), and for brand/macro families, 500 is
 *     also the *exact* literal hex used throughout the source design's own
 *     mockups (rings, buttons, active fills) — kept verbatim for fidelity.
 *   - rung 600 is "fine for large/graphical use" (ring strokes, active-tab
 *     fills) but not guaranteed full text contrast — same caveat the old
 *     brand-600 carried.
 *   - rung 700 >= 4.5:1 against white — light-mode primary text/buttons
 *     (`text-brand-700`, `bg-brand-700`).
 * Full computed ratios below each ramp.
 */

/**
 * brand-500 #9184D9 — the exact blurple used everywhere in the source
 * design's mockups (rings, primary buttons, active states). 50->900.
 * 500 vs dark bg (#161826) = 5.45:1; 700 vs white = 11.92:1; 600 vs white =
 * 7.36:1 (graphical-safe, not required to be full-text-safe).
 */
export const brand = {
  50: '#f4f3fc',
  100: '#e6e3f7',
  200: '#d1ccf0',
  300: '#b8b0e8',
  400: '#b1a8e6',
  500: '#9184d9',
  600: '#5340bf',
  700: '#352684',
  800: '#251b5d',
  900: '#18123d',
} as const

/**
 * brand-600 is only ~7.4:1 against white in the graphical sense the old
 * comment described (still comfortably clears AA here, unlike the old
 * green ramp's 3.51:1 — kept as a rung, not a guarantee, since other
 * families in this file are tighter). Anywhere text sits on/as brand
 * color, use brand-700 — e.g. `bg-brand-700` for primary buttons,
 * `text-brand-700` for brand-colored headings/links. Verified via the
 * axe-core a11y suite (e2e/a11y.spec.ts).
 */

/**
 * Macro colors — reused identically in ring segments, bars, history, and
 * reports. Per the source design's own rule, protein reuses the brand hue
 * (blurple) rather than a fourth distinct color; carbs (sand/gold) and fat
 * (glacier blue) are new hues at the same lightness/saturation curve as
 * brand, so all three read as one consistent family. Fiber (Phase H.1) is a
 * fourth hue (green) at that identical curve, distinct from the other three.
 * carbs: 500 vs dark bg = 9.99:1; 700 vs white = 5.16:1.
 * fat:   500 vs dark bg = 9.05:1; 700 vs white = 5.90:1.
 * fiber: 500 vs dark bg = 10.37:1; 700 vs white = 4.72:1.
 */
export const macros = {
  protein: brand,
  carbs: {
    50: '#fcf9f3',
    100: '#f7f1e3',
    200: '#f0e6cc',
    300: '#e8d8b0',
    400: '#e6d4a8',
    500: '#d9c184',
    600: '#bf9c40',
    700: '#846a26',
    800: '#5d4a1b',
    900: '#3d3112',
  },
  fat: {
    50: '#f3f9fc',
    100: '#e3f2f7',
    200: '#cce7f0',
    300: '#b0dae8',
    400: '#a8d6e6',
    500: '#84c3d9',
    600: '#409ebf',
    700: '#266c84',
    800: '#1b4c5d',
    900: '#12323d',
  },
  fiber: {
    50: '#f3fcf5',
    100: '#e3f7e8',
    200: '#ccf0d5',
    300: '#b0e8be',
    400: '#a8e6b7',
    500: '#84d999',
    600: '#40bf60',
    700: '#26843d',
    800: '#1b5d2b',
    900: '#123d1d',
  },
} as const

/**
 * Macro fill colors (500) are graphical (ring/bar fills) and only need 3:1
 * non-text contrast — fine at 500. Any macro *text* (e.g. a colored label)
 * should use the 700 shade instead (verified >=4.5:1 on white for all
 * three families, incl. protein via `brand`).
 */

/**
 * Semantic bands for calendar days & remaining-kcal states. `over` is a
 * new, dedicated "over budget" hue (warm amber) distinct from `warn`/carbs
 * — the source design's own fix for the old palette's ambiguity, where an
 * over-budget ring and the carbs macro bar were the same color.
 * over: 500 vs dark bg = 8.29:1; 700 vs white = 6.78:1.
 */
export const semantic = {
  success: brand,
  warn: macros.carbs,
  over: {
    50: '#fcf7f3',
    100: '#f7ece3',
    200: '#f0dbcc',
    300: '#e8c8b0',
    400: '#e6c2a8',
    500: '#d9a884',
    600: '#bf7640',
    700: '#844e26',
    800: '#5d371b',
    900: '#3d2412',
  },
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

/**
 * Cool blue-purple neutral (hue ~230°, matching Nocturne's "mono" system)
 * replacing the old slate ramp. 400 vs dark bg (#161826) = 7.64:1; 500 vs
 * white = 5.60:1; 700 vs white = 11.00:1 — same per-rung contract as the
 * old ramp (400 dark-safe, 500/700 light-safe), just recolored.
 */
export const neutral = {
  50: '#f7f7fb',
  100: '#edeef5',
  200: '#dee0ea',
  300: '#c7cad9',
  400: '#a5aac0',
  500: '#636779',
  600: '#4e515f',
  700: '#393c46',
  800: '#272830',
  900: '#181a20',
  950: '#0f1015',
} as const

export const surface = {
  bg: '#f7f7fb',
  card: '#ffffff',
  /** A third, more elevated layer — nested cards, inputs, chips — sitting
   *  above `card`. New in the Nocturne redesign; existing code that only
   *  ever referenced `bg`/`card` is unaffected. */
  raised: '#eef0f7',
  radiusCard: '14px',
  shadowCard: '0 0 0 1px rgb(15 23 42 / 0.08)',
} as const

/**
 * Dark-mode mirror of `surface` — applied via Tailwind's `dark:` variant.
 * `bg`/`card` are the exact values used throughout every screen in the
 * source design (phone-frame background and card background respectively).
 */
export const surfaceDark = {
  bg: '#161826',
  card: '#1c1e2b',
  raised: '#232532',
  radiusCard: '14px',
  shadowCard: '0 0 0 1px rgb(233 233 237 / 0.16)',
} as const

/**
 * Phase F.1: "Contrast" is the third of the design's Dark/Light/Contrast
 * theme picker (frame 36) — a distinct, always-dark, higher-legibility
 * appearance, not a "follow OS" option (that option is retired; see
 * `resolveTheme.ts`'s `migrateStoredPreference`). A deeper background and a
 * brighter accent than the base dark theme are the two changes that matter
 * visually; both are strictly lighter-on-darker than their base-dark
 * counterparts, so contrast against these surfaces is only ever *higher*
 * than the already-verified base-dark ratios above, never lower.
 *
 * These four values are also hand-copied into `src/index.css`'s
 * `:root.contrast` block as CSS custom properties (`tailwind.config.ts`
 * wires `surface-dark.DEFAULT/.card` and `brand.400/.600` to
 * `var(--surface-dark-bg)` etc.) — this is the one token family in this
 * file that isn't consumed purely through Tailwind's static class
 * generation, since a same-class-different-value swap at runtime needs a
 * real CSS variable, not a build-time constant. Keep both in sync by hand
 * if either changes.
 */
export const contrastDark = {
  bg: '#0a0b12',
  card: '#141225',
  brand400: '#c2b8fa',
  brand600: '#6c58e8',
} as const

/**
 * Phase F.0: Inter, loaded via Google Fonts in `index.html` and cached
 * offline by the `runtimeCaching` rule in `vite.config.ts`. The system-font
 * fallback stack still runs first paint (no FOIT before the stylesheet
 * arrives) and covers the rare case the CDN is unreachable.
 */
export const fontFamily = {
  sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  /** Nocturne's uppercase "eyebrow" tag/numeric convention — a system
   *  monospace stack, no webfont needed for this one. */
  mono: ['ui-monospace', 'Menlo', 'Monaco', 'monospace'],
} as const

/** size(px) / weight / lineHeight. */
export const typeScale = {
  display: { fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
  title: { fontSize: '20px', fontWeight: '600', lineHeight: '1.3' },
  body: { fontSize: '15px', fontWeight: '450', lineHeight: '1.5' },
  caption: { fontSize: '12.5px', fontWeight: '450', lineHeight: '1.4' },
  /** The small uppercase monospace label above a section/card, e.g.
   *  "PROTEIN", "WEEK 12 · 84 LOGGED DAYS". Always paired with
   *  `tracking-widest uppercase` at the call site. */
  tag: { fontSize: '10px', fontWeight: '600', lineHeight: '1' },
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
