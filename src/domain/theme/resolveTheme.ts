export type ThemePreference = 'light' | 'dark' | 'contrast'
export type ResolvedTheme = ThemePreference

/**
 * The design's theme picker (frame 36) is Dark/Light/Contrast — there's no
 * "follow OS" option, so a preference now resolves to itself. Kept as a
 * named function (rather than inlined at call sites) so there's one place
 * documenting that identity, matching the shape this always had.
 */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference
}

/**
 * Contrast is a dark-family appearance. Anywhere code has to pick between a
 * literal dark-palette value and a light-palette value directly (SVG stroke
 * colors, chart colors — anywhere Tailwind's `dark:` variant can't reach)
 * should branch on this, not a raw `=== 'dark'` check, or a Contrast user
 * would silently fall back to the light palette.
 */
export function isDarkFamily(resolved: ResolvedTheme): boolean {
  return resolved !== 'light'
}

/**
 * Phase F.1: existing users who had explicitly chosen the now-retired
 * 'system' option get a one-time, seamless landing spot instead of being
 * forced to 'dark' outright — resolve their current OS preference once into
 * a concrete choice, so nobody's screen changes the moment this ships.
 * Anyone who never touched the toggle (nothing stored yet) lands on
 * 'dark', the design's actual default appearance. Call once per device,
 * at read time, and persist the result — see `ThemeContext.tsx`.
 */
export function migrateStoredPreference(stored: string | null, systemPrefersDark: boolean): ThemePreference {
  if (stored === 'light' || stored === 'dark' || stored === 'contrast') return stored
  if (stored === 'system') return systemPrefersDark ? 'dark' : 'light'
  return 'dark'
}
