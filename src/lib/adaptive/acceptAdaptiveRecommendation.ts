import { db as defaultDb, type BitewiseDB } from '../../data/db'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import type { AdaptiveRecommendation } from '../../domain/adaptive/adaptiveTargets'
import { todayISO } from '../date'
import { adaptiveBasisFingerprint } from './fetchAdaptiveRecommendation'

export class StaleAdaptiveRecommendationError extends Error {
  constructor() {
    super('Your plan changed since this review. Reload the plan before applying an adjustment.')
    this.name = 'StaleAdaptiveRecommendationError'
  }
}

/** Compare the complete reviewed basis and insert atomically across concurrent tabs. */
export async function acceptAdaptiveRecommendation(recommendation: AdaptiveRecommendation, db: BitewiseDB = defaultDb): Promise<void> {
  await db.transaction('rw', [db.profiles, db.targets, db.syncMeta, db.syncOutbox], async () => {
    const today = todayISO()
    const [targetHistory, profile, meta] = await Promise.all([
      new TargetRepo(db).getAll(), new ProfileRepo(db).get(), db.syncMeta.toCollection().first(),
    ])
    const applicableTargets = targetHistory.filter((target) => target.effectiveDate <= today)
    const currentTargets = applicableTargets[applicableTargets.length - 1]
    if (!profile || !currentTargets || !recommendation.basis || recommendation.basis.referenceDate !== today ||
        currentTargets.kcal !== recommendation.currentKcal ||
        adaptiveBasisFingerprint(profile, currentTargets, meta?.linkedUserId ?? meta?.userId ?? null) !== recommendation.basis.fingerprint) {
      throw new StaleAdaptiveRecommendationError()
    }
    const proteinG = currentTargets.proteinG
    const fatG = currentTargets.fatG
    if (recommendation.suggestedKcal < Math.ceil(proteinG * 4 + fatG * 9)) {
      throw new Error('This target cannot accommodate your protein and fat targets. Review your plan again.')
    }
    const carbsG = Math.max(0, Math.round((recommendation.suggestedKcal - proteinG * 4 - fatG * 9) / 4))
    await new TargetRepo(db).add({
      effectiveDate: today, kcal: recommendation.suggestedKcal,
      proteinG, carbsG, fatG, fiberG: currentTargets.fiberG, source: 'adaptive',
    })
  })
}
