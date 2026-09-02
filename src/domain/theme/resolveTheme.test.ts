import { describe, expect, it } from 'vitest'
import { isDarkFamily, migrateStoredPreference, resolveTheme } from './resolveTheme'

describe('resolveTheme', () => {
  it('resolves to itself for each of the three concrete preferences', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('contrast')).toBe('contrast')
  })
})

describe('isDarkFamily', () => {
  it('treats dark and contrast as the dark family', () => {
    expect(isDarkFamily('dark')).toBe(true)
    expect(isDarkFamily('contrast')).toBe(true)
  })

  it('treats light as not dark', () => {
    expect(isDarkFamily('light')).toBe(false)
  })
})

describe('migrateStoredPreference', () => {
  it('passes through an already-concrete preference unchanged', () => {
    expect(migrateStoredPreference('light', true)).toBe('light')
    expect(migrateStoredPreference('dark', false)).toBe('dark')
    expect(migrateStoredPreference('contrast', false)).toBe('contrast')
  })

  it('resolves a legacy "system" value against the current OS preference, once', () => {
    expect(migrateStoredPreference('system', true)).toBe('dark')
    expect(migrateStoredPreference('system', false)).toBe('light')
  })

  it('defaults anyone with no stored preference at all to dark', () => {
    expect(migrateStoredPreference(null, false)).toBe('dark')
    expect(migrateStoredPreference(null, true)).toBe('dark')
  })

  it('defaults an unrecognized/corrupt stored value to dark rather than throwing', () => {
    expect(migrateStoredPreference('not-a-real-value', false)).toBe('dark')
  })
})
