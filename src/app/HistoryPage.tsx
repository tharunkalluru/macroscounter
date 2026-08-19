import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry, Targets } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { computeAverage, groupEntriesByDate } from '../domain/history/averages'
import { classifyDay, type DayColorBand } from '../domain/history/colorBand'
import { findApplicableTarget } from '../domain/history/targetForDate'
import { addDaysISO, getMonthGrid, isFutureDate, todayISO } from '../lib/date'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const BAND_CLASSES: Record<DayColorBand, string> = {
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  green: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/40 dark:text-red-300',
}

export default function HistoryPage() {
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
  const avg7 = useMemo(
    () => computeAverage(recentDayTotals.filter((d) => d.date >= addDaysISO(todayISO(), -6))),
    [recentDayTotals]
  )
  const avg30 = useMemo(() => computeAverage(recentDayTotals), [recentDayTotals])

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
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-flex min-h-touch items-center text-sm text-brand-700 dark:text-brand-400 underline">
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700">History</h1>

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

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div
          className="rounded-lg bg-white dark:bg-surface-dark-card p-3 shadow-sm"
          data-testid="avg-7day"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">7-day avg</p>
          <p className="text-lg font-semibold">
            {avg7.daysCounted > 0 ? `${avg7.kcal} kcal` : '—'}
          </p>
        </div>
        <div
          className="rounded-lg bg-white dark:bg-surface-dark-card p-3 shadow-sm"
          data-testid="avg-30day"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">30-day avg</p>
          <p className="text-lg font-semibold">
            {avg30.daysCounted > 0 ? `${avg30.kcal} kcal` : '—'}
          </p>
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
