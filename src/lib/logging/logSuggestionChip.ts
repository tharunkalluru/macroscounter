import type { Meal } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { formatPortion } from '../../domain/logging/formatPortion'
import { computeMacrosForGrams } from '../../domain/logging/portionMath'
import type { SuggestionChip } from '../../domain/logging/suggestions'

/**
 * One-tap-logs every entry in a suggestion chip (a previously-repeated food
 * combo for a meal slot). Shared by MealSection's empty-state "your usual?"
 * chip and the time-aware meal prompt sheet (Phase 10.3) — same action,
 * different trigger.
 */
export async function logSuggestionChip(
  chip: SuggestionChip,
  meal: Meal,
  date: string,
  logRepo: LogRepo = new LogRepo(),
  foodRepo: FoodRepo = new FoodRepo()
): Promise<void> {
  const foods = await foodRepo.getByIds(chip.entries.map((e) => e.foodId))
  const foodsById = new Map(foods.map((f) => [f.id, f]))

  for (const entry of chip.entries) {
    const food = foodsById.get(entry.foodId)
    if (!food) continue
    const macros = computeMacrosForGrams(food.per100g, entry.grams)
    await logRepo.addEntry({
      date,
      meal,
      foodId: entry.foodId,
      name: food.name,
      portionSummary: formatPortion({
        qty: entry.qty,
        unit: entry.unit,
        grams: entry.grams,
        portionLabel: entry.portionLabel,
      }),
      portionLabel: entry.portionLabel,
      qty: entry.qty,
      unit: entry.unit,
      grams: entry.grams,
      ...macros,
    })
  }
}
