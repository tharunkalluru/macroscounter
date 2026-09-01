import { LogRepo } from '../../data/repos/LogRepo'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import {
  computeAdaptiveAdjustment,
  type AdaptiveRecommendation,
} from '../../domain/adaptive/adaptiveTargets'
import { computeKcalFloor } from '../../domain/goals/goalEngine'
import { groupEntriesByDate } from '../../domain/history/averages'
import { addDaysISO, todayISO } from '../date'

export interface AdaptiveRecommendationResult {
  recommendation: AdaptiveRecommendation | null
  /** True when this week's adjustment has already been accepted — a fresh recommendation still computes, but callers that shouldn't re-suggest it (the Today card) check this. */
  alreadyAppliedThisWeek: boolean
}

/**
 * Shared data-fetch + computation behind both the Today quick-accept card
 * (AdaptiveTargetPrompt) and the Coach weekly check-in wizard — same
 * `computeAdaptiveAdjustment` call, same inputs, so the two surfaces never
 * disagree about what this week's recommendation is.
 */
export async function fetchAdaptiveRecommendation(
  referenceDate: string = todayISO()
): Promise<AdaptiveRecommendationResult> {
  const windowStart = addDaysISO(referenceDate, -6)

  const [profile, targets, entries, weighIns] = await Promise.all([
    new ProfileRepo().get(),
    new TargetRepo().getLatest(),
    new LogRepo().getEntriesForDateRange(windowStart, referenceDate),
    new WeighInRepo().getInRange(windowStart, referenceDate),
  ])
  if (!profile || !targets) {
    return { recommendation: null, alreadyAppliedThisWeek: false }
  }

  const alreadyAppliedThisWeek = targets.source === 'adaptive' && targets.effectiveDate >= windowStart

  const floorKcal = computeKcalFloor(profile.sex, profile.weightKg, profile.heightCm, profile.age)
  const result = computeAdaptiveAdjustment({
    loggedDays: groupEntriesByDate(entries),
    weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    currentTargetKcal: targets.kcal,
    floorKcal,
    referenceDate,
  })

  return {
    recommendation: result && result.adjustment !== 0 ? result : null,
    alreadyAppliedThisWeek,
  }
}
