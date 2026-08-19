import { describe, expect, it } from 'vitest'
import { resolveTheme } from './resolveTheme'

describe('resolveTheme', () => {
  it('returns dark when preference is explicitly dark, regardless of system', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('returns light when preference is explicitly light, regardless of system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('follows the system preference when set to "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
