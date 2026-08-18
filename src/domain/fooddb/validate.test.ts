import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Food } from './types'

const fooddbPath = resolve(__dirname, '../../../public/fooddb.json')
const foods: Food[] = JSON.parse(readFileSync(fooddbPath, 'utf-8'))

describe('food database integrity', () => {
  it('has at least 300 curated foods', () => {
    expect(foods.length).toBeGreaterThanOrEqual(300)
  })

  it('every food has a positive kcal value', () => {
    for (const food of foods) {
      expect(food.per100g.kcal, `${food.name} should have kcal > 0`).toBeGreaterThan(0)
    }
  })

  it('macros are consistent with kcal within 15% tolerance (Atwater 4/4/9)', () => {
    for (const food of foods) {
      const { kcal, p, c, f } = food.per100g
      const computed = 4 * p + 4 * c + 9 * f
      const diff = Math.abs(kcal - computed)
      const tolerance = kcal * 0.15
      expect(
        diff,
        `${food.name}: kcal=${kcal} computed=${computed.toFixed(1)} diff=${diff.toFixed(1)} tolerance=${tolerance.toFixed(1)}`
      ).toBeLessThanOrEqual(tolerance)
    }
  })

  it('every food has at least one portion', () => {
    for (const food of foods) {
      expect(food.portions.length, `${food.name} should have >= 1 portion`).toBeGreaterThanOrEqual(1)
    }
  })

  it('every portion has a positive gram value', () => {
    for (const food of foods) {
      for (const portion of food.portions) {
        expect(portion.grams, `${food.name} portion "${portion.label}"`).toBeGreaterThan(0)
      }
    }
  })

  it('has unique ids', () => {
    const ids = foods.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique names', () => {
    const names = foods.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every food has a non-empty category and source', () => {
    for (const food of foods) {
      expect(food.category).toBeTruthy()
      expect(food.source).toBeTruthy()
    }
  })
})
