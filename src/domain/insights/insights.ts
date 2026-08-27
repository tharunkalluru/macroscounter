import type { Meal } from '../../data/models'

export interface Insight {
  id: 'weekend-vs-weekday' | 'top-meal' | 'macro-balance'
  text: string
}

export interface MacroTarget {
  proteinG: number
  carbsG: number
  fatG: number
}

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

function isWeekend(dateISO: string): boolean {
  const [y, m, d] = dateISO.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Needs at least 3 weekdays and 2 weekend days logged so a single unusual day
 * can't flip the comparison, and only surfaces the insight once the gap is
 * large enough (>=8%) to be a real pattern rather than noise.
 */
export function computeWeekendVsWeekdayInsight(days: { date: string; kcal: number }[]): Insight | null {
  const weekday = days.filter((d) => !isWeekend(d.date))
  const weekend = days.filter((d) => isWeekend(d.date))
  if (weekday.length < 3 || weekend.length < 2) return null

  const weekdayAvg = average(weekday.map((d) => d.kcal))
  const weekendAvg = average(weekend.map((d) => d.kcal))
  if (weekdayAvg === 0) return null

  const diff = weekendAvg - weekdayAvg
  const pct = Math.round((Math.abs(diff) / weekdayAvg) * 100)
  if (pct < 8) return null

  const higher = diff > 0 ? 'weekends' : 'weekdays'
  return {
    id: 'weekend-vs-weekday',
    text: `You tend to eat ${pct}% more on ${higher} than the rest of the week.`,
  }
}

/** Only surfaces once one meal clearly dominates (>=35% of average daily calories). */
export function computeTopMealInsight(entries: { meal: Meal; kcal: number }[]): Insight | null {
  if (entries.length === 0) return null

  const totals = new Map<Meal, number>()
  for (const e of entries) {
    totals.set(e.meal, (totals.get(e.meal) ?? 0) + e.kcal)
  }
  const totalKcal = [...totals.values()].reduce((sum, v) => sum + v, 0)
  if (totalKcal === 0) return null

  let topMeal: Meal | null = null
  let topShare = 0
  for (const [meal, kcal] of totals) {
    const share = kcal / totalKcal
    if (share > topShare) {
      topShare = share
      topMeal = meal
    }
  }
  if (!topMeal || topShare < 0.35) return null

  return {
    id: 'top-meal',
    text: `${MEAL_LABELS[topMeal]} makes up ${Math.round(topShare * 100)}% of your average day's calories.`,
  }
}

/**
 * Flags whichever macro sits furthest from its target on average, but only
 * once the gap is at least 20% — small day-to-day variance shouldn't read as
 * an actionable pattern.
 */
export function computeMacroBalanceInsight(
  days: { p: number; c: number; f: number }[],
  target: MacroTarget
): Insight | null {
  if (days.length < 4) return null

  const macros = [
    { label: 'protein', avg: average(days.map((d) => d.p)), target: target.proteinG },
    { label: 'carbs', avg: average(days.map((d) => d.c)), target: target.carbsG },
    { label: 'fat', avg: average(days.map((d) => d.f)), target: target.fatG },
  ]

  let worst: (typeof macros)[number] | null = null
  let worstPct = 0
  for (const m of macros) {
    if (m.target <= 0) continue
    const pct = Math.abs(m.avg - m.target) / m.target
    if (pct > worstPct) {
      worstPct = pct
      worst = m
    }
  }
  if (!worst || worstPct < 0.2) return null

  const direction = worst.avg > worst.target ? 'over' : 'under'
  return {
    id: 'macro-balance',
    text: `You're averaging ${Math.round(worstPct * 100)}% ${direction} your ${worst.label} target.`,
  }
}

export function computeInsights(
  days: { date: string; kcal: number; p: number; c: number; f: number }[],
  mealEntries: { meal: Meal; kcal: number }[],
  target: MacroTarget
): Insight[] {
  return [
    computeWeekendVsWeekdayInsight(days),
    computeTopMealInsight(mealEntries),
    computeMacroBalanceInsight(days, target),
  ].filter((insight): insight is Insight => insight !== null)
}
