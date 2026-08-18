/** Finds the target row in effect on `date`: the one with the latest effectiveDate <= date. */
export function findApplicableTarget<T extends { effectiveDate: string }>(
  date: string,
  targets: T[]
): T | undefined {
  let best: T | undefined
  for (const target of targets) {
    if (target.effectiveDate <= date && (!best || target.effectiveDate > best.effectiveDate)) {
      best = target
    }
  }
  return best
}
