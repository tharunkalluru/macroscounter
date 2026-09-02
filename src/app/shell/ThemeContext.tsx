/* eslint-disable react-refresh/only-export-components -- context + hook are colocated by design */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  isDarkFamily,
  migrateStoredPreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../../domain/theme/resolveTheme'

export const THEME_STORAGE_KEY = 'macrodesi-theme'

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Reads the stored preference and migrates a legacy 'system' value (or no
 *  value at all) to one of the three concrete preferences — see
 *  `migrateStoredPreference`'s own doc comment. Persists the migrated value
 *  immediately so it only ever runs once per device. */
function readAndMigrateStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  const migrated = migrateStoredPreference(stored, getSystemPrefersDark())
  if (stored !== migrated) localStorage.setItem(THEME_STORAGE_KEY, migrated)
  return migrated
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', isDarkFamily(resolved))
  document.documentElement.classList.toggle('contrast', resolved === 'contrast')
}

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readAndMigrateStoredPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference))

  // Runs on mount (in case index.html's pre-paint script didn't execute —
  // e.g. a component test rendering ThemeProvider directly in jsdom) and on
  // every subsequent preference change.
  useEffect(() => {
    const resolved = resolveTheme(preference)
    setResolvedTheme(resolved)
    applyResolvedTheme(resolved)
  }, [preference])

  const setPreference = useCallback((pref: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
    setPreferenceState(pref)
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
