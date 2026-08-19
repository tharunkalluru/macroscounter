import { describe, expect, it } from 'vitest'
import { brand, macros, semantic, surface, touchTarget, typeScale } from './tokens'

describe('design tokens match the ux-polish-spec values', () => {
  it('brand-600 is #0F9D58', () => {
    expect(brand[600]).toBe('#0F9D58')
  })

  it('macro colors match the spec exactly (protein/carbs/fat)', () => {
    expect(macros.protein[600]).toBe('#7c3aed')
    expect(macros.carbs[500]).toBe('#f59e0b')
    expect(macros.fat[500]).toBe('#0ea5e9')
  })

  it('semantic bands alias the right palettes', () => {
    expect(semantic.success).toBe(brand)
    expect(semantic.warn).toBe(macros.carbs)
  })

  it('surface tokens match the spec', () => {
    expect(surface.bg).toBe('#F8FAF9')
    expect(surface.card).toBe('#FFFFFF')
    expect(surface.radiusCard).toBe('16px')
  })

  it('type scale matches the spec (size/weight/lineHeight)', () => {
    expect(typeScale.display).toEqual({ fontSize: '32px', fontWeight: '700', lineHeight: '1.2' })
    expect(typeScale.title.fontSize).toBe('20px')
    expect(typeScale.body.fontSize).toBe('15px')
    expect(typeScale.caption.fontSize).toBe('12.5px')
  })

  it('minimum touch target is 44px', () => {
    expect(touchTarget.minPx).toBe(44)
  })
})
