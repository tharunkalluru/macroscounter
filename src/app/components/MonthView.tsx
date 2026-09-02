import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry, Targets } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { computeAverage, groupEntriesByDate } from '../../domain/history/averages'
import { classifyDay, type DayColorBand } from '../../domain/history/colorBand'
import { findApplicableTarget } from '../../domain/history/targetForDate'
import { addDaysISO, getMonthGrid, isFutureDate, todayISO } from '../../lib/date'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BAND_CLASSES: Record<DayColorBand, string> = {
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  green: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/40 dark:text-red-300',
}

/** Calendar month grid + 7/30-day averages + a link into weight tracking — the "Month" view of the Log tab (Phase R.3), extracted from the original standalone HistoryPage so `/history` and `/log`'s Month tab share one implementation. */
export default function MonthView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [monthIndex0, setMonthIndex0] = useState(today.getMonth())
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [targets, setTargets] = useState<Targets[]>([])
  const [recentEntries, setRecentEntries] = useState<LogEntry[]>([])

  const grid = useMemo(() => getMonthGrid(year, monthIndex0), [year, monthIndex0])
  const monthLabel = new Date(year, monthIndex0, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    const days = grid.filter((d): d is string => d !== null)
    if (days.length === 0) return
    ;(async () => {
      const monthEntries = await new LogRepo().getEntriesForDateRange(
        days[0],
        days[days.length - 1]
      )
      setEntries(monthEntries)
    })()
  }, [grid])

  useEffect(() => {
    ;(async () => {
      const [allTargets, last30] = await Promise.all([
        new TargetRepo().getAll(),
        new LogRepo().getEntriesForDateRange(addDaysISO(todayISO(), -29), todayISO()),
      ])
      setTargets(allTargets)
      setRecentEntries(last30)
    })()
  }, [])

  const dayTotalsByDate = useMemo(() => {
    const totals = groupEntriesByDate(entries)
    return new Map(totals.map((t) => [t.date, t]))
  }, [entries])

  const recentDayTotals = useMemo(() => groupEntriesByDate(recentEntries), [recentEntries])
  const avg30 = useMemo(() => computeAverage(recentDayTotals), [recentDayTotals])

  // "At a glance" (design frame 16) is scoped to the month actually being
  // viewed, not a rolling window — the past-days-only filter matters when
  // looking at the current month before it's finished.
  const monthDaysSoFar = useMemo(() => {
    const days = grid.filter((d): d is string => d !== null && !isFutureDate(d))
    return days
  }, [grid])
  const monthDayTotals = useMemo(
    () => monthDaysSoFar.map((d) => dayTotalsByDate.get(d)).filter((t): t is NonNullable<typeof t> => t !== undefined),
    [monthDaysSoFar, dayTotalsByDate]
  )
  const monthAverage = useMemo(() => computeAverage(monthDayTotals), [monthDayTotals])
  const daysLoggedThisMonth = monthDayTotals.length

  function changeMonth(delta: number) {
    let newMonth = monthIndex0 + delta
    let newYear = year
    if (newMonth < 0) {
      newMonth = 11
      newYear -= 1
    } else if (newMonth > 11) {
      newMonth = 0
      newYear += 1
    }
    // Guard: don't allow navigating into a future month.
    if (
      newYear > today.getFullYear() ||
      (newYear === today.getFullYear() && newMonth > today.getMonth())
    ) {
      return
    }
    setYear(newYear)
    setMonthIndex0(newMonth)
  }

  const isCurrentMonth = year === today.getFullYear() && monthIndex0 === today.getMonth()

  return (
    <div>
      <div className="rounded-xl bg-white dark:bg-surface-dark-card px-1 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between px-2 text-sm">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="inline-flex min-h-touch items-center text-brand-700 underline dark:text-brand-400"
          >
            ← Prev
          </button>
          <span className="font-medium">{monthLabel}</span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            disabled={isCurrentMonth}
            className="inline-flex min-h-touch items-center text-brand-700 underline disabled:pointer-events-none disabled:opacity-30 dark:text-brand-400"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1" data-testid="calendar-grid">
          {grid.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} />
            const future = isFutureDate(date)
            const total = dayTotalsByDate.get(date)
            const target = findApplicableTarget(date, targets)
            const band = future ? 'none' : classifyDay(total?.kcal, target?.kcal)
            const dayNum = Number(date.slice(-2))

            const cellClasses = `flex aspect-square items-center justify-center rounded text-sm ${BAND_CLASSES[band]}`

            return future ? (
              <div
                key={date}
                className="flex aspect-square items-center justify-center rounded text-sm bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                data-testid={`day-${date}`}
              >
                {dayNum}
              </div>
            ) : (
              <Link
                key={date}
                to={`/history/${date}`}
                className={cellClasses}
                data-testid={`day-${date}`}
                data-band={band}
              >
                {dayNum}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-6 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card">
        <p className="mb-3 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {monthLabel} at a glance
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div data-testid="month-avg-kcal">
            <p className="text-title font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {monthAverage.daysCounted > 0 ? monthAverage.kcal : '—'}
            </p>
            <p className="text-caption text-slate-500 dark:text-slate-400">Avg kcal / day</p>
          </div>
          <div data-testid="month-days-logged">
            <p className="text-title font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {daysLoggedThisMonth} / {monthDaysSoFar.length}
            </p>
            <p className="text-caption text-slate-500 dark:text-slate-400">Days logged</p>
          </div>
          <div data-testid="month-avg-protein">
            <p className="text-title font-semibold tabular-nums text-brand-700 dark:text-brand-400">
              {monthAverage.daysCounted > 0 ? `${monthAverage.p} g` : '—'}
            </p>
            <p className="text-caption text-slate-500 dark:text-slate-400">Avg protein</p>
          </div>
          <div data-testid="avg-30day">
            <p className="text-title font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {avg30.daysCounted > 0 ? avg30.kcal : '—'}
            </p>
            <p className="text-caption text-slate-500 dark:text-slate-400">30-day avg kcal</p>
          </div>
        </div>
      </div>

      <Link
        to="/weight"
        className="mt-6 inline-flex min-h-touch items-center text-sm text-brand-700 underline dark:text-brand-400"
      >
        Weight tracking →
      </Link>
    </div>
  )
}
