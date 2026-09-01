/**
 * Finds the target row in effect on `date`: the one with the latest
 * effectiveDate <= date. When two targets share the same effectiveDate
 * (e.g. a same-day Coach adjustment superseding the day's original target),
 * the one appearing later in `targets` wins — callers pass rows from
 * `TargetRepo.getAll()`, whose ascending `effectiveDate` order resolves
 * ties by insertion order, so "later in the array" means "more recently
 * created" for a tied date.
 */
export function findApplicableTarget<T extends { effectiveDate: string }>(
  date: string,
  targets: T[]
): T | undefined {
  let best: T | undefined
  for (const target of targets) {
    if (target.effectiveDate <= date && (!best || target.effectiveDate >= best.effectiveDate)) {
      best = target
    }
  }
  return best
}
