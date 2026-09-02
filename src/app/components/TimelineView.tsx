import { AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'
import type { LogEntry, Meal } from '../../data/models'
import EntryRow from './EntryRow'

interface Props {
  entries: LogEntry[]
  onDelete: (id: number) => void
}

/** A typical hour for each meal slot — used only for entries logged before
 *  `LogEntry.loggedAt` existed, so old history still renders somewhere
 *  sensible on the Timeline instead of vanishing from this view. */
const FALLBACK_HOUR: Record<Meal, number> = { breakfast: 8, lunch: 13, snacks: 16, dinner: 20 }

function hourOf(entry: LogEntry): number {
  if (entry.loggedAt) {
    const parsed = new Date(entry.loggedAt)
    if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
  }
  return FALLBACK_HOUR[entry.meal]
}

function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
}

/** Hour-by-hour grouping of a day's entries (the design's Log-tab Timeline view, frame 12). */
export default function TimelineView({ entries, onDelete }: Props) {
  const byHour = useMemo(() => {
    const grouped = new Map<number, LogEntry[]>()
    for (const entry of entries) {
      const hour = hourOf(entry)
      if (!grouped.has(hour)) grouped.set(hour, [])
      grouped.get(hour)!.push(entry)
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0])
  }, [entries])

  if (byHour.length === 0) {
    return (
      <p className="py-6 text-center text-caption text-slate-500 dark:text-slate-400" data-testid="timeline-view">
        Nothing logged yet today.
      </p>
    )
  }

  return (
    <div className="flex flex-col" data-testid="timeline-view">
      {byHour.map(([hour, items]) => {
        const subtotal = Math.round(items.reduce((sum, e) => sum + e.kcal, 0))
        return (
          <div key={hour} className="flex gap-3">
            <span className="w-12 flex-none pt-1 text-caption font-medium text-slate-400 dark:text-slate-400">
              {formatHour(hour)}
            </span>
            <div className="flex flex-1 flex-col gap-1.5 border-l border-slate-100 pb-5 pl-3 dark:border-slate-700">
              <AnimatePresence initial={false}>
                {items.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onSwipeDelete={(e) => e.id !== undefined && onDelete(e.id)}
                  />
                ))}
              </AnimatePresence>
              <span
                className="text-caption font-medium text-slate-400 dark:text-slate-400"
                data-testid={`timeline-hour-subtotal-${hour}`}
              >
                {subtotal} kcal
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
