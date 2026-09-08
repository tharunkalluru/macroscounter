import type { FoodRecord, LogEntry, MealTemplateEntry, MealTemplateSnapshot } from '../../data/models'
import { computeMacrosForGrams, gramsForPortion } from '../logging/portionMath'

export type TemplateEntryInput = MealTemplateEntry
export type AppliedTemplateEntry = MealTemplateSnapshot

/** Keep nutrition and the selected portion; never copy a log's identity. */
export function buildTemplateEntries(entries: LogEntry[]): MealTemplateEntry[] {
  return entries.map((entry) => ({
    foodId: entry.foodId,
    qty: entry.qty,
    unit: entry.unit,
    snapshot: {
      foodId: entry.foodId,
      barcode: entry.barcode,
      customSnapshot: entry.customSnapshot ? { ...entry.customSnapshot } : undefined,
      name: entry.name,
      portionSummary: entry.portionSummary,
      portionLabel: entry.portionLabel,
      qty: entry.qty,
      unit: entry.unit,
      grams: entry.grams,
      kcal: entry.kcal,
      p: entry.p,
      c: entry.c,
      f: entry.f,
      fiber: entry.fiber,
    },
  }))
}

/**
 * New templates preserve the complete saved meal, including custom foods,
 * recipes and label nutrition. Legacy {foodId, qty, unit} templates continue
 * resolving against current foods with their original primary-portion rule.
 */
export function applyTemplate(
  entries: TemplateEntryInput[],
  foodsById: Map<string, FoodRecord>
): AppliedTemplateEntry[] {
  return entries.map((entry) => {
    if (entry.snapshot) {
      return { ...entry.snapshot, customSnapshot: entry.snapshot.customSnapshot ? { ...entry.snapshot.customSnapshot } : undefined }
    }
    const food = entry.foodId ? foodsById.get(entry.foodId) : undefined
    if (!food) throw new Error(`Unknown food id in template: ${entry.foodId}`)

    let grams: number
    let portionSummary: string
    let portionLabel: string | undefined
    if (entry.unit === 'grams') {
      grams = entry.qty
      portionSummary = `${grams} g`
    } else {
      const portion = food.portions[0]
      if (!portion) throw new Error(`No serving size is available for ${food.name}`)
      grams = gramsForPortion(entry.qty, portion.grams)
      portionSummary = `${entry.qty} x ${portion.label}`
      portionLabel = portion.label
    }

    const macros = computeMacrosForGrams(food.per100g, grams)
    return {
      foodId: entry.foodId,
      name: food.name,
      portionSummary,
      portionLabel,
      qty: entry.qty,
      unit: entry.unit,
      grams,
      ...macros,
    }
  })
}
