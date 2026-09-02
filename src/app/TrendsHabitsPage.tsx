import { useEffect, useMemo, useState } from 'react'
import { LogRepo } from '../data/repos/LogRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { groupEntriesByDate } from '../domain/history/averages'
import { computeHabitsWeek, type DayHabit } from '../domain/habits/habitsWeek'
import { computeBestStreak, computeConsistency, computeStreak } from '../domain/streaks/streak'
import { addDaysISO, todayISO } from '../lib/date'
import HabitHeatmap from './components/HabitHeatmap'
import PageHeader from './components/PageHeader'
import { FlameIcon } from './shell/icons'

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const HEATMAP_DAYS = 30

function lastNDays(n: number, referenceDate: string): string[] {
  return Array.from({ length: n }, (_, i) => addDaysISO(referenceDate, -(n - 1 - i)))
}

export default function TrendsHabitsPage() {
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [consistency, setConsistency] = useState(0)
  const [week, setWeek] = useState<DayHabit[] | null>(null)
  const [heatmap, setHeatmap] = useState<{ date: string; logged: boolean }[] | null>(null)

  useEffect(() => {
    ;(async () => {
      const today = todayISO()
      const days = lastNDays(7, today)
      const windowStart = days[0]
      // A full-history scan for the "best streak ever" record and the
      // heatmap needs every logged date, not just a trailing window --
      // there's no persisted record of this, so it's recomputed each visit.
      const [targets, weekEntries, allEntries, weighIns] = await Promise.all([
        new TargetRepo().getLatest(),
        new LogRepo().getEntriesForDateRange(windowStart, today),
        new LogRepo().getEntriesForDateRange('2000-01-01', today),
        new WeighInRepo().getInRange(windowStart, today),
      ])

      const loggedDates = groupEntriesByDate(allEntries).map((d) => d.date)
      setStreak(computeStreak(loggedDates, today))
      setBestStreak(computeBestStreak(loggedDates))
      setConsistency(computeConsistency(loggedDates, today, 30))

      const loggedSet = new Set(loggedDates)
      setHeatmap(lastNDays(HEATMAP_DAYS, today).map((date) => ({ date, logged: loggedSet.has(date) })))

      const proteinByDate = new Map(groupEntriesByDate(weekEntries).map((d) => [d.date, d.p]))
      const weighInDates = new Set(weighIns.map((w) => w.date))
      setWeek(computeHabitsWeek(days, weighInDates, proteinByDate, targets?.proteinG ?? 0))
    })()
  }, [])

  const weighInsCompleted = useMemo(() => week?.filter((d) => d.loggedWeighIn).length ?? 0, [week])
  const missedInHeatmap = useMemo(() => heatmap?.filter((d) => !d.logged).length ?? 0, [heatmap])

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Habits" backTo="/trends" />

      <div className="mb-4 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="streak-widget">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <FlameIcon className="text-carbs-600 dark:text-carbs-400" /> Logging streak
          </span>
          <span className="text-caption font-medium tabular-nums text-slate-500 dark:text-slate-400">
            Best {bestStreak}
          </span>
        </div>
        <p className="mb-3 text-display font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {streak} <span className="text-body font-normal text-slate-500 dark:text-slate-400">day{streak === 1 ? '' : 's'} unbroken</span>
        </p>
        {heatmap && <HabitHeatmap days={heatmap} />}
        {heatmap && (
          <p className="mt-2 text-caption text-slate-500 dark:text-slate-400">
            {missedInHeatmap === 0
              ? `Every day logged in the last ${HEATMAP_DAYS}.`
              : `${missedInHeatmap} missed day${missedInHeatmap === 1 ? '' : 's'} in ${HEATMAP_DAYS}. A missed day doesn't reset you — it just doesn't count.`}
          </p>
        )}
      </div>

      <div className="mb-4" data-testid="consistency-widget">
        <p className="text-caption text-slate-500 dark:text-slate-400">Consistency (30d)</p>
        <p className="text-lg font-semibold tabular-nums">{Math.round(consistency * 100)}%</p>
      </div>

      {week && (
        <div className="flex flex-col gap-4">
          <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="weighin-week-grid">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-caption text-slate-500 dark:text-slate-400">Weigh-ins this week</p>
              <p className="text-caption font-medium tabular-nums">{weighInsCompleted}/7</p>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {week.map((day, i) => (
                <div key={day.date} className="flex flex-col items-center gap-1">
                  <div
                    data-testid={`weighin-day-${day.date}`}
                    data-completed={day.loggedWeighIn}
                    className={`aspect-square w-full rounded-md ${
                      day.loggedWeighIn ? 'bg-brand-600 dark:bg-brand-400' : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  />
                  <span className="text-caption text-slate-400 dark:text-slate-500">{WEEKDAY_LETTERS[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="protein-habit-chart">
            <p className="mb-2 text-caption text-slate-500 dark:text-slate-400">Protein target hit-rate</p>
            <div className="flex items-end gap-1.5" style={{ height: 72 }}>
              {week.map((day, i) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      data-testid={`protein-day-${day.date}`}
                      className="w-full rounded-t bg-protein-500"
                      style={{ height: `${Math.max(day.proteinHitRate * 100, 2)}%` }}
                    />
                  </div>
                  <span className="text-caption text-slate-400 dark:text-slate-500">{WEEKDAY_LETTERS[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
