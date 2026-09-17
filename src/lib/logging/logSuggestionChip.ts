import type { Meal } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { formatPortion } from '../../domain/logging/formatPortion'
import { computeMacrosForGrams } from '../../domain/logging/portionMath'
import type { SuggestionChip } from '../../domain/logging/suggestions'

/** Resolve every entry first, then commit the complete meal and backup queue atomically. */
export async function logSuggestionChip(
  chip: SuggestionChip,
  meal: Meal,
  date: string,
  logRepo: LogRepo = new LogRepo(),
  foodRepo: FoodRepo = new FoodRepo()
): Promise<number[]> {
  const ids = chip.entries.flatMap((entry) => !entry.snapshot && entry.foodId ? [entry.foodId] : [])
  const foods = ids.length > 0 ? await foodRepo.getByIds(ids) : []
  const foodsById = new Map(foods.map((food) => [food.id, food]))
  const entries = chip.entries.map((entry) => {
    if (entry.snapshot) return { ...entry.snapshot, customSnapshot: entry.snapshot.customSnapshot ? { ...entry.snapshot.customSnapshot } : undefined, date, meal }
    const food = entry.foodId ? foodsById.get(entry.foodId) : undefined
    if (!food) throw new Error('One of the saved foods is unavailable. No entries were added.')
    return {
      date, meal, foodId: entry.foodId, name: food.name,
      portionSummary: formatPortion({ qty: entry.qty, unit: entry.unit, grams: entry.grams, portionLabel: entry.portionLabel }),
      portionLabel: entry.portionLabel, qty: entry.qty, unit: entry.unit, grams: entry.grams,
      ...computeMacrosForGrams(food.per100g, entry.grams),
    }
  })
  return logRepo.addEntries(entries)
}
