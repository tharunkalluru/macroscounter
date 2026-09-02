import { describe, expect, it } from 'vitest'
import {
  computeMacrosForGrams,
  computeMacrosForServings,
  gramsForPortion,
  sumMacros,
  sumMacrosByMeal,
} from './portionMath'

// Real fixture values from public/fooddb.json: Idli per100g {kcal:102.5,p:4.5,c:20,f:0.5},
// Sambar per100g {kcal:62,p:3,c:8,f:2}.
const IDLI_PER_100G = { kcal: 102.5, p: 4.5, c: 20, f: 0.5 }
const SAMBAR_PER_100G = { kcal: 62, p: 3, c: 8, f: 2 }

describe('gramsForPortion', () => {
  it('multiplies qty by the portion gram size', () => {
    expect(gramsForPortion(2, 40)).toBe(80)
    expect(gramsForPortion(1, 150)).toBe(150)
    expect(gramsForPortion(0.5, 200)).toBe(100)
  })
})

describe('computeMacrosForGrams', () => {
  it('2 idli (80g): scales per-100g macros by grams/100', () => {
    const result = computeMacrosForGrams(IDLI_PER_100G, gramsForPortion(2, 40))
    expect(result).toEqual({ kcal: 82, p: 3.6, c: 16, f: 0.4 })
  })

  it('1 katori sambar (150g)', () => {
    const result = computeMacrosForGrams(SAMBAR_PER_100G, gramsForPortion(1, 150))
    expect(result).toEqual({ kcal: 93, p: 4.5, c: 12, f: 3 })
  })

  it('2 idli + 1 katori sambar sums to the expected breakfast totals', () => {
    const idli = computeMacrosForGrams(IDLI_PER_100G, gramsForPortion(2, 40))
    const sambar = computeMacrosForGrams(SAMBAR_PER_100G, gramsForPortion(1, 150))
    const total = sumMacros([idli, sambar])
    expect(total).toEqual({ kcal: 175, p: 8.1, c: 28, f: 3.4, fiber: 0 })
  })

  it('a gram-override entry uses the raw grams directly', () => {
    const result = computeMacrosForGrams(IDLI_PER_100G, 25)
    expect(result).toEqual({ kcal: 25.6, p: 1.1, c: 5, f: 0.1 })
  })
})

describe('computeMacrosForServings', () => {
  // A manufacturer's declared per-serving figures don't always equal
  // per100g x servingGrams/100 exactly (independently rounded on the label)
  // -- this is the whole reason to scale perServing directly instead of
  // recomputing from per100g, e.g. a 325ml protein shake labeled 160 kcal.
  const PROTEIN_SHAKE_PER_SERVING = { kcal: 160, p: 20, c: 12, f: 3 }

  it('1 serving returns the label figures unchanged', () => {
    expect(computeMacrosForServings(PROTEIN_SHAKE_PER_SERVING, 1)).toEqual({
      kcal: 160,
      p: 20,
      c: 12,
      f: 3,
    })
  })

  it('2 servings doubles every macro', () => {
    expect(computeMacrosForServings(PROTEIN_SHAKE_PER_SERVING, 2)).toEqual({
      kcal: 320,
      p: 40,
      c: 24,
      f: 6,
    })
  })

  it('a fractional serving count scales proportionally', () => {
    expect(computeMacrosForServings(PROTEIN_SHAKE_PER_SERVING, 0.5)).toEqual({
      kcal: 80,
      p: 10,
      c: 6,
      f: 1.5,
    })
  })
})

describe('sumMacrosByMeal', () => {
  it('aggregates entries per meal and zeroes out meals with no entries', () => {
    const entries = [
      { meal: 'breakfast' as const, kcal: 82, p: 3.6, c: 16, f: 0.4 },
      { meal: 'breakfast' as const, kcal: 93, p: 4.5, c: 12, f: 3 },
      { meal: 'lunch' as const, kcal: 400, p: 20, c: 40, f: 10 },
    ]
    const byMeal = sumMacrosByMeal(entries)
    expect(byMeal.breakfast).toEqual({ kcal: 175, p: 8.1, c: 28, f: 3.4, fiber: 0 })
    expect(byMeal.lunch).toEqual({ kcal: 400, p: 20, c: 40, f: 10, fiber: 0 })
    expect(byMeal.snacks).toEqual({ kcal: 0, p: 0, c: 0, f: 0, fiber: 0 })
    expect(byMeal.dinner).toEqual({ kcal: 0, p: 0, c: 0, f: 0, fiber: 0 })
  })
})
