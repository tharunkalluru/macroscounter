import { describe, expect, it } from 'vitest'
import { brand, contrastDark, macros, semantic, surface, surfaceDark, touchTarget, typeScale } from './tokens'

describe('design tokens match the Nocturne redesign (Phase R.0) values', () => {
  it('brand-500 is the exact blurple used throughout the source design', () => {
    expect(brand[500]).toBe('#9184d9')
  })

  it('macro colors match the spec (protein reuses brand; carbs/fat get their own hues)', () => {
    expect(macros.protein).toBe(brand)
    expect(macros.carbs[500]).toBe('#d9c184')
    expect(macros.fat[500]).toBe('#84c3d9')
  })

  it('semantic bands alias the right palettes, plus a dedicated over-budget hue', () => {
    expect(semantic.success).toBe(brand)
    expect(semantic.warn).toBe(macros.carbs)
    expect(semantic.over[500]).toBe('#d9a884')
    expect(semantic.over).not.toBe(macros.carbs)
  })

  it('surface tokens match the spec', () => {
    expect(surface.bg).toBe('#f7f7fb')
    expect(surface.card).toBe('#ffffff')
    expect(surface.radiusCard).toBe('20px')
  })

  it('dark surfaces are true OLED black, per direct request', () => {
    expect(surfaceDark.bg).toBe('#000000')
    // Card stays a hair above pure black -- enough to register as a
    // distinct layer alongside the existing hairline border without
    // meaningfully compromising the OLED-black goal.
    expect(surfaceDark.card).toBe('#0a0a0d')
    // Contrast is the maximal, fully uniform all-black tier: nothing left
    // to darken beyond what base Dark already is.
    expect(contrastDark.bg).toBe('#000000')
    expect(contrastDark.card).toBe('#000000')
  })

  it('type scale is unchanged by the redesign (system font stack kept)', () => {
    expect(typeScale.display).toEqual({ fontSize: '32px', fontWeight: '700', lineHeight: '1.2' })
    expect(typeScale.title.fontSize).toBe('20px')
    expect(typeScale.body.fontSize).toBe('15px')
    expect(typeScale.caption.fontSize).toBe('12.5px')
  })

  it('minimum touch target is 44px', () => {
    expect(touchTarget.minPx).toBe(44)
  })
})
