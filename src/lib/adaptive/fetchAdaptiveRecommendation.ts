import { db as defaultDb, type BitewiseDB } from '../../data/db'
import type { Profile, Targets } from '../../data/models'
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
  /** Includes a valid no-change review, unlike the actionable recommendation. */
  review: AdaptiveRecommendation | null
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
  referenceDate: string = todayISO(),
  db: BitewiseDB = defaultDb,
): Promise<AdaptiveRecommendationResult> {
  const windowStart = addDaysISO(referenceDate, -6)

  const [profile, targetHistory, entries, weighIns, meta] = await db.transaction(
    'r', [db.profiles, db.targets, db.logEntries, db.weighIns, db.syncMeta],
    () => Promise.all([
      new ProfileRepo(db).get(), new TargetRepo(db).getAll(),
      new LogRepo(db).getEntriesForDateRange(windowStart, referenceDate),
      new WeighInRepo(db).getInRange(windowStart, referenceDate),
      db.syncMeta.toCollection().first(),
    ]),
  )
  const applicableTargets = targetHistory.filter((target) => target.effectiveDate <= referenceDate)
  const targets = applicableTargets[applicableTargets.length - 1]
  if (!profile || !targets) {
    return { recommendation: null, review: null, alreadyAppliedThisWeek: false }
  }

  const alreadyAppliedThisWeek = targets.source === 'adaptive' && targets.effectiveDate >= windowStart

  const floorKcal = Math.max(
    computeKcalFloor(profile.sex, profile.weightKg, profile.heightCm, profile.age),
    Math.ceil(targets.proteinG * 4 + targets.fatG * 9),
  )
  const result = computeAdaptiveAdjustment({
    loggedDays: groupEntriesByDate(entries),
    weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
    currentTargetKcal: targets.kcal,
    floorKcal,
    referenceDate,
    goal: profile.goal,
    goalRateLbPerWeek: profile.goalRateLbPerWeek,
  })

  if (result) result.basis = {
    fingerprint: adaptiveBasisFingerprint(profile, targets, meta?.linkedUserId ?? meta?.userId ?? null),
    referenceDate, proteinG: targets.proteinG, fatG: targets.fatG,
  }
  return {
    recommendation: result && result.adjustment !== 0 ? result : null,
    review: result,
    alreadyAppliedThisWeek,
  }
}

/** Identity plus every value that can alter the reviewed plan. Never used as authentication. */
export function adaptiveBasisFingerprint(profile: Profile, target: Targets, accountId: string | null): string {
  return JSON.stringify([
    accountId,
    profile.id, profile.clientId, profile.updatedAt, profile.goal, profile.goalRateLbPerWeek,
    profile.sex, profile.age, profile.heightCm, profile.weightKg, profile.goalWeightKg,
    profile.dietStyle, profile.proteinPriority, profile.calorieFloorChoice,
    target.id, target.clientId, target.updatedAt, target.effectiveDate, target.source,
    target.kcal, target.proteinG, target.carbsG, target.fatG, target.fiberG,
  ])
}
