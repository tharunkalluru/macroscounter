import type { FoodItemResult } from '../../../api/ai/analyze'

export const REVIEW_NUTRIENTS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'] as const
export type ReviewNutrient = (typeof REVIEW_NUTRIENTS)[number]

export interface MealReviewItem {
  original: FoodItemResult
  name: string
  amount: string
  included: boolean
  values: Record<ReviewNutrient, string>
  perUnit: Record<ReviewNutrient, number>
}

const round = (value: number) => Math.round(value * 10) / 10

export function createMealReviewItem(food: FoodItemResult): MealReviewItem {
  const amount = food.gramsEstimate ?? 1
  return {
    original: food,
    name: food.name,
    amount: String(amount),
    included: true,
    values: Object.fromEntries(
      REVIEW_NUTRIENTS.map((key) => [key, String(food[key])])
    ) as MealReviewItem['values'],
    perUnit: Object.fromEntries(
      REVIEW_NUTRIENTS.map((key) => [key, food[key] / amount])
    ) as MealReviewItem['perUnit'],
  }
}

/** Keep an unrounded basis so repeated portion edits never compound rounding. */
export function resizeMealReviewItem(item: MealReviewItem, amount: string): MealReviewItem {
  const quantity = Number(amount)
  if (!amount.trim() || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
    return { ...item, amount }
  }
  return {
    ...item,
    amount,
    values: Object.fromEntries(
      REVIEW_NUTRIENTS.map((key) => [key, String(round(item.perUnit[key] * quantity))])
    ) as MealReviewItem['values'],
  }
}

/** A manual nutrient correction becomes the basis for subsequent portion edits. */
export function editMealReviewNutrient(
  item: MealReviewItem,
  key: ReviewNutrient,
  value: string
): MealReviewItem {
  const quantity = Number(item.amount)
  const nutrient = Number(value)
  const valid = value.trim() && Number.isFinite(nutrient) && nutrient >= 0 && quantity > 0
  return {
    ...item,
    values: { ...item.values, [key]: value },
    perUnit: valid ? { ...item.perUnit, [key]: nutrient / quantity } : item.perUnit,
  }
}

export function reviewedFood(item: MealReviewItem): FoodItemResult | null {
  const amount = Number(item.amount)
  if (
    !item.name.trim() ||
    item.name.trim().length > 200 ||
    !item.amount.trim() ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 100000
  )
    return null
  const values = {} as Record<ReviewNutrient, number>
  for (const key of REVIEW_NUTRIENTS) {
    const value = Number(item.values[key])
    if (!item.values[key].trim() || !Number.isFinite(value) || value < 0 || value > 100000)
      return null
    values[key] = round(value)
  }
  return {
    ...item.original,
    ...values,
    name: item.name.trim(),
    gramsEstimate: item.original.gramsEstimate === null ? null : amount,
  }
}

export function reviewTotals(items: MealReviewItem[]): Record<ReviewNutrient, number> {
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  for (const item of items) {
    if (!item.included) continue
    const food = reviewedFood(item)
    if (!food) continue
    for (const key of REVIEW_NUTRIENTS) totals[key] += food[key]
  }
  for (const key of REVIEW_NUTRIENTS) totals[key] = round(totals[key])
  return totals
}

/** Attachment failures are recoverable after the diary has committed. */
export async function attachReviewPhotos(
  ids: number[],
  attach: (id: number) => Promise<unknown>
): Promise<number[]> {
  const results = await Promise.allSettled(
    ids.map((id) => Promise.resolve().then(() => attach(id)))
  )
  return ids.filter((_, index) => results[index].status === 'rejected')
}

export async function commitReviewedMeal(
  saveEntries: () => Promise<number[]>,
  onCommitted: (ids: number[]) => void,
  attach?: (id: number) => Promise<unknown>
): Promise<{ ids: number[]; failedPhotoIds: number[] }> {
  const ids = await saveEntries()
  onCommitted(ids)
  return { ids, failedPhotoIds: attach ? await attachReviewPhotos(ids, attach) : [] }
}
