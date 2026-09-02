import { describe, expect, it } from 'vitest'
import { computeMacrosForGrams } from '../logging/portionMath'
import amulButter from './fixtures/off-amul-butter.json'
import { parseOFFResponse } from './offParser'
import { getServingOptions } from './servingOptions'

describe('getServingOptions', () => {
  it('builds serving + pack + half-pack options from servingSize and quantity', () => {
    const product = parseOFFResponse('8901491101615', amulButter)!
    const options = getServingOptions(product)
    expect(options).toEqual([
      { label: '1 serving', grams: 10 },
      { label: '1 pack', grams: 500 },
      { label: '½ pack', grams: 250 },
    ])
  })

  it('falls back to a plain 100g option when nothing else is known', () => {
    expect(getServingOptions({})).toEqual([{ label: '100 g', grams: 100 }])
  })

  it('handles serving size without a known package quantity', () => {
    expect(getServingOptions({ servingSize: 25 })).toEqual([{ label: '1 serving', grams: 25 }])
  })
})

describe('per-serving vs per-100g math', () => {
  it('deriving macros for the serving grams from per100g matches OFF-reported per-serving values', () => {
    const product = parseOFFResponse('8901491101615', amulButter)!
    const derived = computeMacrosForGrams(product.per100g, product.servingSize!)
    // OFF's own energy-kcal_serving/proteins_serving/etc. for this fixture.
    expect(derived).toEqual({ kcal: 71.7, p: 0.1, c: 0, f: 8, fiber: 0 })
    // Consistent with the (higher-precision) OFF-reported perServing within rounding.
    expect(derived.kcal).toBeCloseTo(product.perServing!.kcal, 1)
    expect(derived.f).toBeCloseTo(product.perServing!.f, 1)
  })
})
