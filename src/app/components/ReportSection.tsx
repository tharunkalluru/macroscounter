import { useEffect, useState } from 'react'
import { LogRepo } from '../../data/repos/LogRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { groupEntriesByDate } from '../../domain/history/averages'
import { computeWeeklyReport, type WeeklyReport } from '../../domain/reports/weeklyReport'
import { computeConsistency, computeStreak } from '../../domain/streaks/streak'
import { addDaysISO, todayISO } from '../../lib/date'

export default function ReportSection() {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [streak, setStreak] = useState(0)
  const [consistency, setConsistency] = useState(0)

  useEffect(() => {
    ;(async () => {
      const today = todayISO()
      const [targets, last30Entries] = await Promise.all([
        new TargetRepo().getAll(),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -29), today),
      ])
      const latestTarget = targets[targets.length - 1]
      const dayTotals = groupEntriesByDate(last30Entries)
      const last7 = dayTotals.filter((d) => d.date >= addDaysISO(today, -6))

      if (latestTarget) {
        setReport(computeWeeklyReport(last7, latestTarget))
      }

      const loggedDates = dayTotals.map((d) => d.date)
      setStreak(computeStreak(loggedDates, today))
      setConsistency(computeConsistency(loggedDates, today, 30))
    })()
  }, [])

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div
          className="rounded-card bg-white dark:bg-surface-dark-card p-3 shadow-card"
          data-testid="streak-widget"
        >
          <p className="text-caption text-slate-500 dark:text-slate-400">Logging streak</p>
          <p className="text-lg font-semibold tabular-nums">
            {streak} day{streak === 1 ? '' : 's'}
          </p>
        </div>
        <div
          className="rounded-card bg-white dark:bg-surface-dark-card p-3 shadow-card"
          data-testid="consistency-widget"
        >
          <p className="text-caption text-slate-500 dark:text-slate-400">Consistency (30d)</p>
          <p className="text-lg font-semibold tabular-nums">{Math.round(consistency * 100)}%</p>
        </div>
      </div>

      {report && report.daysCounted > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card">
            <p className="text-caption text-slate-500 dark:text-slate-400">
              Avg calories (last 7 logged days)
            </p>
            <p className="text-display tabular-nums" data-testid="report-avg-kcal">
              {report.avgKcal} kcal
            </p>
          </div>
          <div className="rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card">
            <p className="text-caption text-slate-500 dark:text-slate-400">
              Protein target hit-rate
            </p>
            <p className="text-display tabular-nums" data-testid="report-protein-hitrate">
              {Math.round(report.proteinHitRate * 100)}%
            </p>
          </div>
          <div className="rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card">
            <p className="text-caption text-slate-500 dark:text-slate-400">Best day</p>
            <p data-testid="report-best-day">
              {report.bestDay?.date} — {report.bestDay?.kcal} kcal
            </p>
          </div>
          <div className="rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card">
            <p className="text-caption text-slate-500 dark:text-slate-400">Toughest day</p>
            <p data-testid="report-worst-day">
              {report.worstDay?.date} — {report.worstDay?.kcal} kcal
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Log a few days to see your weekly report.
        </p>
      )}
    </div>
  )
}
