import type { LogEntry } from '../../data/models'

/**
 * Clones a set of source entries (typically yesterday's log for one meal)
 * onto a new target date, dropping the stale id so each becomes a fresh row.
 * Macro/portion data is carried over as-is (a snapshot of what was logged,
 * same as any other duplicate-entry action) rather than re-derived from the
 * food DB, so copying is a pure, deterministic clone.
 */
export function buildCopiedEntries(sourceEntries: LogEntry[], targetDate: string): Omit<LogEntry, 'id'>[] {
  return sourceEntries.map(({ id: _id, ...rest }) => ({
    ...rest,
    date: targetDate,
  }))
}
