const STORAGE_KEY = 'macrodesi:foodSourcePreferences'

export interface FoodSourcePreferences {
  off: boolean
  fdc: boolean
}

const DEFAULTS: FoodSourcePreferences = { off: true, fdc: true }

/** Per-source barcode-lookup preferences (Settings > Food log defaults) — local-only, no sync, same storage pattern as the theme preference. */
export function getFoodSourcePreferences(): FoodSourcePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function setFoodSourcePreference(source: keyof FoodSourcePreferences, enabled: boolean): void {
  const current = getFoodSourcePreferences()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [source]: enabled }))
}
