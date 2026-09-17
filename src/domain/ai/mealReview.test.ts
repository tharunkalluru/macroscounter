import { describe, expect, it, vi } from 'vitest'
import {
  attachReviewPhotos,
  commitReviewedMeal,
  createMealReviewItem,
  editMealReviewNutrient,
  resizeMealReviewItem,
  reviewedFood,
  reviewTotals,
} from './mealReview'

const food = {
  name: 'Dal',
  gramsEstimate: 200,
  kcal: 250,
  proteinG: 14,
  carbsG: 36,
  fatG: 6,
  fiberG: 8,
  confidence: 'low' as const,
}

describe('meal review', () => {
  it('rescales fractional portions without compounding rounded values', () => {
    let item = createMealReviewItem(food)
    item = resizeMealReviewItem(item, '63')
    expect(reviewedFood(item)?.kcal).toBe(78.8)
    item = resizeMealReviewItem(item, '200')
    expect(reviewedFood(item)).toEqual(food)
  })
  it('keeps manual nutrient corrections when a portion changes', () => {
    const item = editMealReviewNutrient(createMealReviewItem(food), 'kcal', '300')
    expect(reviewedFood(resizeMealReviewItem(item, '100'))?.kcal).toBe(150)
  })
  it('supports quantities without pretending an unknown gram weight is known', () => {
    const item = createMealReviewItem({ ...food, gramsEstimate: null })
    expect(reviewedFood(resizeMealReviewItem(item, '0.5'))).toMatchObject({
      gramsEstimate: null,
      kcal: 125,
      fiberG: 4,
    })
  })
  it.each(['', '-2', '0', 'NaN', 'Infinity', '100001'])('rejects invalid portion %s', (amount) => {
    expect(reviewedFood(resizeMealReviewItem(createMealReviewItem(food), amount))).toBeNull()
  })
  it('does not count unchecked items and blocks incomplete nutrition', () => {
    const valid = createMealReviewItem(food)
    const invalid = editMealReviewNutrient(valid, 'proteinG', '')
    expect(reviewedFood(invalid)).toBeNull()
    expect(reviewTotals([valid, { ...valid, included: false }, invalid])).toMatchObject({
      kcal: 250,
      proteinG: 14,
      fiberG: 8,
    })
  })
})

describe('meal/photo persistence boundary', () => {
  it('does not attach photos or report a commit when the atomic save fails', async () => {
    const committed = vi.fn()
    const attach = vi.fn()
    await expect(
      commitReviewedMeal(() => Promise.reject(new Error('storage full')), committed, attach)
    ).rejects.toThrow('storage full')
    expect(committed).not.toHaveBeenCalled()
    expect(attach).not.toHaveBeenCalled()
  })
  it('reports a committed meal before photos, and retries only failed attachments', async () => {
    const saved = vi.fn().mockResolvedValue([31, 32])
    const committed = vi.fn()
    const attach = vi.fn(async (id: number) => {
      expect(committed).toHaveBeenCalledWith([31, 32])
      if (id === 32) throw new Error('photo storage full')
    })
    const result = await commitReviewedMeal(saved, committed, attach)
    expect(result.failedPhotoIds).toEqual([32])
    const retryAttach = vi.fn().mockResolvedValue(undefined)
    expect(await attachReviewPhotos(result.failedPhotoIds, retryAttach)).toEqual([])
    expect(retryAttach).toHaveBeenCalledExactlyOnceWith(32)
    expect(saved).toHaveBeenCalledTimes(1)
  })
})
