import { TargetRepo } from '../../data/repos/TargetRepo'
import type { AdaptiveRecommendation } from '../../domain/adaptive/adaptiveTargets'
import { todayISO } from '../date'

/**
 * Saves a new Target row for an accepted weekly adjustment — protein/fat
 * carried over from the current targets, carbs recomputed to fill the rest
 * of the new kcal figure. Shared by the Today quick-accept card and the
 * Coach weekly check-in wizard so an "accept" means the same thing either
 * way it's reached.
 */
export async function acceptAdaptiveRecommendation(recommendation: AdaptiveRecommendation): Promise<void> {
  const currentTargets = await new TargetRepo().getLatest()
  const proteinG = currentTargets?.proteinG ?? 0
  const fatG = currentTargets?.fatG ?? 0
  const carbsG = Math.max(0, Math.round((recommendation.suggestedKcal - proteinG * 4 - fatG * 9) / 4))

  await new TargetRepo().add({
    effectiveDate: todayISO(),
    kcal: recommendation.suggestedKcal,
    proteinG,
    carbsG,
    fatG,
    source: 'adaptive',
  })
}
