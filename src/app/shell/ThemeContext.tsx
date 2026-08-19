/* eslint-disable react-refresh/only-export-components -- context + hook are colocated by design */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resolveTheme, type ResolvedTheme, type ThemePreference } from '../../domain/theme/resolveTheme'

export const THEME_STORAGE_KEY = 'macrodesi-theme'

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(preference, getSystemPrefersDark())
  )

  useEffect(() => {
    const resolved = resolveTheme(preference, getSystemPrefersDark())
    setResolvedTheme(resolved)
    applyResolvedTheme(resolved)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      const resolved = resolveTheme('system', mediaQuery.matches)
      setResolvedTheme(resolved)
      applyResolvedTheme(resolved)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
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
