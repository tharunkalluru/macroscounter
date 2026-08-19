import { describe, expect, it } from 'vitest'
import { formatPortion } from './formatPortion'

describe('formatPortion', () => {
  it('renders a single whole serving', () => {
    expect(formatPortion({ qty: 1, unit: 'portion', grams: 40, portionLabel: '1 idli' })).toBe('1 idli')
  })

  it('renders multiple whole servings as a natural count, not a multiplier', () => {
    expect(formatPortion({ qty: 3, unit: 'portion', grams: 120, portionLabel: '1 idli' })).toBe('3 idli')
  })

  it('renders a half serving with a fraction glyph', () => {
    expect(formatPortion({ qty: 0.5, unit: 'portion', grams: 20, portionLabel: '1 idli' })).toBe('½ idli')
  })

  it('renders a whole-plus-half serving', () => {
    expect(formatPortion({ qty: 1.5, unit: 'portion', grams: 60, portionLabel: '1 idli' })).toBe('1½ idli')
  })

  it('falls back to a decimal for a non-half fraction', () => {
    expect(formatPortion({ qty: 1.25, unit: 'portion', grams: 50, portionLabel: '1 idli' })).toBe('1.25 idli')
  })

  it('preserves a multi-word noun phrase', () => {
    expect(formatPortion({ qty: 1, unit: 'portion', grams: 350, portionLabel: '1 large latte' })).toBe(
      '1 large latte'
    )
  })

  it('scales a multi-word noun phrase by count', () => {
    expect(formatPortion({ qty: 2, unit: 'portion', grams: 700, portionLabel: '1 large latte' })).toBe(
      '2 large latte'
    )
  })

  it('handles a portion whose base label already represents more than one unit', () => {
    expect(formatPortion({ qty: 1, unit: 'portion', grams: 80, portionLabel: '2 idli' })).toBe('2 idli')
  })

  it('multiplies a multi-unit base label correctly', () => {
    expect(formatPortion({ qty: 2, unit: 'portion', grams: 160, portionLabel: '2 idli' })).toBe('4 idli')
  })

  it('renders a small abbreviated unit (tsp/tbsp) unchanged at qty 1', () => {
    expect(formatPortion({ qty: 1, unit: 'portion', grams: 5, portionLabel: '1 tsp' })).toBe('1 tsp')
  })

  it('never shows a raw "N x 100 g" multiplier for the grams-fallback portion — collapses to plain grams', () => {
    // A scanned product with no known serving/pack size falls back to a "100 g"
    // portion; picking qty=3.13 of it must never render as "3.13 x 100 g".
    expect(formatPortion({ qty: 3.13, unit: 'portion', grams: 313, portionLabel: '100 g' })).toBe('313 g')
  })

  it('falls back to plain grams when there is no portion label (grams-mode entry)', () => {
    expect(formatPortion({ qty: 120, unit: 'grams', grams: 120 })).toBe('120 g')
  })

  it('falls back to plain grams when the label cannot be parsed', () => {
    expect(formatPortion({ qty: 1, unit: 'portion', grams: 30, portionLabel: 'Handful' })).toBe('Handful')
  })

  it('renders custom/quick-add entries with a fixed label regardless of grams', () => {
    expect(formatPortion({ qty: 1, unit: 'grams', grams: 0, isCustom: true })).toBe('Custom entry')
  })
})
