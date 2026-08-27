import { useEffect, useState } from 'react'
import { LogRepo } from '../../data/repos/LogRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { groupEntriesByDate } from '../../domain/history/averages'
import { computeInsights, type Insight } from '../../domain/insights/insights'
import { addDaysISO, todayISO } from '../../lib/date'
import { SparkleIcon } from '../shell/icons'

/** Looks back far enough (30d) that a single unusual day can't dominate the pattern, matching ReportSection's window. */
export default function InsightsSection() {
  const [insights, setInsights] = useState<Insight[] | null>(null)

  useEffect(() => {
    ;(async () => {
      const today = todayISO()
      const [targets, entries] = await Promise.all([
        new TargetRepo().getAll(),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -29), today),
      ])
      const latestTarget = targets[targets.length - 1]
      if (!latestTarget) {
        setInsights([])
        return
      }
      const dayTotals = groupEntriesByDate(entries)
      setInsights(
        computeInsights(
          dayTotals,
          entries.map((e) => ({ meal: e.meal, kcal: e.kcal })),
          latestTarget
        )
      )
    })()
  }, [])

  if (insights === null) return null

  if (insights.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Keep logging — patterns in how you eat will show up here.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="insights-section">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="flex items-start gap-3 rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
          data-testid={`insight-${insight.id}`}
        >
          <SparkleIcon className="mt-0.5 shrink-0 text-brand-500" />
          <p className="text-sm">{insight.text}</p>
        </div>
      ))}
    </div>
  )
}
