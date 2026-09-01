import type { Targets } from '../../data/models'

export interface CurrentProgram {
  /** effectiveDate of the most recent 'computed' target — a deliberate from-scratch recalculation, not a weekly nudge. */
  startDate: string
  /** 1-indexed week number since startDate. */
  weekNumber: number
  /** Count of earlier 'computed' targets before the current one. */
  pastProgramsCount: number
}

/**
 * Derives the current "program" (Coach's Strategy hub) from the Targets
 * timeline the app already stores — no new schema. A 'computed' target
 * (onboarding, or Settings' "Save & recalculate") starts a new program;
 * 'adaptive' targets are weekly nudges within the same program, not a new
 * one. Returns null only when there's no target history at all.
 */
export function deriveCurrentProgram(targets: Targets[], referenceDate: string): CurrentProgram | null {
  if (targets.length === 0) return null

  const computedTargets = [...targets]
    .filter((t) => t.source === 'computed')
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))

  const startDate = computedTargets.length > 0 ? computedTargets[computedTargets.length - 1].effectiveDate : targets[0].effectiveDate
  const pastProgramsCount = Math.max(0, computedTargets.length - 1)

  const daysSinceStart = daysBetween(startDate, referenceDate)
  const weekNumber = Math.max(1, Math.floor(daysSinceStart / 7) + 1)

  return { startDate, weekNumber, pastProgramsCount }
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / msPerDay)
}
