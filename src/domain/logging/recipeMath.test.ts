import { describe, expect, it } from 'vitest'
import { computeRecipe } from './recipeMath'

const IDLI_PER_100G = { kcal: 102.5, p: 4.5, c: 20, f: 0.5 }
const SAMBAR_PER_100G = { kcal: 62, p: 3, c: 8, f: 2 }

describe('computeRecipe', () => {
  it('combines 2 idli (80g) + 1 katori sambar (150g) into a per-100g profile', () => {
    const foodsById = new Map([
      ['idli', IDLI_PER_100G],
      ['sambar', SAMBAR_PER_100G],
    ])
    const result = computeRecipe(
      [
        { foodId: 'idli', grams: 80 },
        { foodId: 'sambar', grams: 150 },
      ],
      foodsById,
      1
    )

    expect(result.totalGrams).toBe(230)
    expect(result.computedPer100g).toEqual({ kcal: 76.1, p: 3.5, c: 12.2, f: 1.5 })
    expect(result.gramsPerServing).toBe(230)
  })

  it('divides grams-per-serving across multiple servings', () => {
    const foodsById = new Map([
      ['idli', IDLI_PER_100G],
      ['sambar', SAMBAR_PER_100G],
    ])
    const result = computeRecipe(
      [
        { foodId: 'idli', grams: 160 },
        { foodId: 'sambar', grams: 300 },
      ],
      foodsById,
      2
    )
    expect(result.totalGrams).toBe(460)
    expect(result.gramsPerServing).toBe(230)
    // Per-100g profile is independent of serving count.
    expect(result.computedPer100g).toEqual({ kcal: 76.1, p: 3.5, c: 12.2, f: 1.5 })
  })

  it('throws on an unknown ingredient id', () => {
    const foodsById = new Map([['idli', IDLI_PER_100G]])
    expect(() => computeRecipe([{ foodId: 'ghost', grams: 100 }], foodsById, 1)).toThrow(
      /Unknown ingredient/
    )
  })

  it('throws with no ingredients or zero servings', () => {
    const foodsById = new Map([['idli', IDLI_PER_100G]])
    expect(() => computeRecipe([], foodsById, 1)).toThrow(/at least one ingredient/)
    expect(() => computeRecipe([{ foodId: 'idli', grams: 100 }], foodsById, 0)).toThrow(
      /at least one serving/
    )
  })
})
