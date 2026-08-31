import { useEffect, useState } from 'react'
import { LogRepo } from '../../data/repos/LogRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import type { DayTotal } from '../../domain/history/averages'
import { groupEntriesByDate } from '../../domain/history/averages'
import {
  compareWeeklyReports,
  computeWeeklyReport,
  type WeekComparison,
  type WeeklyReport,
} from '../../domain/reports/weeklyReport'
import { computeConsistency, computeStreak } from '../../domain/streaks/streak'
import { addDaysISO, todayISO } from '../../lib/date'
import CalorieTrendChart from './CalorieTrendChart'

export default function ReportSection() {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [comparison, setComparison] = useState<WeekComparison | null>(null)
  const [streak, setStreak] = useState(0)
  const [consistency, setConsistency] = useState(0)
  const [last14, setLast14] = useState<DayTotal[]>([])
  const [targetKcal, setTargetKcal] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      const today = todayISO()
      // Streak needs a wider lookback than the 30-day report/consistency
      // window so a streak longer than 30 days isn't silently undercounted.
      const [targets, last30Entries, streakEntries] = await Promise.all([
        new TargetRepo().getAll(),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -29), today),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -179), today),
      ])
      const latestTarget = targets[targets.length - 1]
      const dayTotals = groupEntriesByDate(last30Entries)
      const last7 = dayTotals.filter((d) => d.date >= addDaysISO(today, -6))

      if (latestTarget) {
        const currentReport = computeWeeklyReport(last7, latestTarget)
        setReport(currentReport)
        setTargetKcal(latestTarget.kcal)

        const previousWeekStart = addDaysISO(today, -13)
        const previousWeekEnd = addDaysISO(today, -7)
        const previous7 = dayTotals.filter(
          (d) => d.date >= previousWeekStart && d.date <= previousWeekEnd
        )
        const previousReport = computeWeeklyReport(previous7, latestTarget)
        setComparison(compareWeeklyReports(currentReport, previousReport, latestTarget.kcal))
      }

      setLast14(dayTotals.filter((d) => d.date >= addDaysISO(today, -13)))

      const loggedDates = dayTotals.map((d) => d.date)
      setStreak(computeStreak(groupEntriesByDate(streakEntries).map((d) => d.date), today))
      setConsistency(computeConsistency(loggedDates, today, 30))
    })()
  }, [])

  return (
    <div>
      {last14.length > 1 && <CalorieTrendChart data={last14} targetKcal={targetKcal} />}

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
          {comparison && comparison.hasPreviousData && (
            <div
              className="rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
              data-testid="report-week-comparison"
            >
              <p className="text-caption text-slate-500 dark:text-slate-400">Vs last week</p>
              <p className="mt-1 text-sm" data-testid="report-comparison-kcal">
                {comparison.avgKcalDelta === 0 ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    Same average calories as last week
                  </span>
                ) : (
                  <span
                    className={
                      comparison.kcalCloserToTarget
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {comparison.avgKcalDelta > 0 ? '▲' : '▼'}{' '}
                    {Math.abs(comparison.avgKcalDelta)} kcal avg,{' '}
                    {comparison.kcalCloserToTarget ? 'closer to target' : 'farther from target'}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm" data-testid="report-comparison-protein">
                {comparison.proteinHitRateDelta === 0 ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    Same protein hit-rate as last week
                  </span>
                ) : (
                  <span
                    className={
                      comparison.proteinHitRateDelta > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {comparison.proteinHitRateDelta > 0 ? '▲' : '▼'}{' '}
                    {Math.abs(Math.round(comparison.proteinHitRateDelta * 100))}pt protein
                    hit-rate
                  </span>
                )}
              </p>
            </div>
          )}
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
