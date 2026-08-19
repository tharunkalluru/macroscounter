import type { FoodRecord, Unit } from '../../data/models'
import { computeMacrosForGrams, gramsForPortion, type MacroTotals } from '../logging/portionMath'

export interface TemplateEntryInput {
  foodId: string
  qty: number
  unit: Unit
}

export interface AppliedTemplateEntry extends MacroTotals {
  foodId: string
  name: string
  portionSummary: string
  portionLabel?: string
  qty: number
  unit: Unit
  grams: number
}

/**
 * Resolves a saved template's {foodId, qty, unit} entries into full log-entry
 * data using each food's *current* per-100g values (a template just remembers
 * what to log, not stale macro snapshots — if the food DB changes, applying
 * an old template reflects the update). A 'portion' unit always refers to the
 * food's first/primary portion, since MealTemplateEntry (per the schema)
 * doesn't record which portion index was originally picked.
 */
export function applyTemplate(
  entries: TemplateEntryInput[],
  foodsById: Map<string, FoodRecord>
): AppliedTemplateEntry[] {
  return entries.map((entry) => {
    const food = foodsById.get(entry.foodId)
    if (!food) throw new Error(`Unknown food id in template: ${entry.foodId}`)

    let grams: number
    let portionSummary: string
    let portionLabel: string | undefined
    if (entry.unit === 'grams') {
      grams = entry.qty
      portionSummary = `${grams} g`
    } else {
      const portion = food.portions[0]
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
