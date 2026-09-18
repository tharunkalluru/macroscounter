import { useEffect, useRef } from 'react'
import type { LogEntry } from '../../data/models'
import { addDaysISO } from '../../lib/date'
import { sumMacros } from '../../domain/logging/portionMath'

export default function WeeklyDiaryCard({ date, entries, onSelect }: {
  date: string
  entries: LogEntry[]
  onSelect: (date: string) => void
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // At narrow widths retain 44px targets and bring the selected (last) day into view.
    const strip = stripRef.current
    if (strip) strip.scrollLeft = strip.scrollWidth - strip.clientWidth
  }, [date])
  const days = Array.from({ length: 7 }, (_, i) => {
    const value = addDaysISO(date, i - 6)
    const logged = entries.filter((entry) => entry.date === value)
    return { date: value, count: logged.length, kcal: Math.round(sumMacros(logged).kcal) }
  })
  const loggedDays = days.filter((day) => day.count > 0)
  return (
    <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark" aria-label="Seven-day diary" data-testid="weekly-diary-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Last 7 days</h2>
        <span className="text-caption font-medium text-brand-700 dark:text-brand-400">{loggedDays.length} / 7 days logged</span>
      </div>
      <div ref={stripRef} className="my-3 overflow-x-auto"><div className="grid min-w-[308px] grid-cols-7 gap-0">
        {days.map((day) => {
          const dt = new Date(`${day.date}T12:00:00`)
          return <button key={day.date} type="button" onClick={() => onSelect(day.date)}
            aria-current={day.date === date ? 'date' : undefined}
            aria-label={`${dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}: ${day.count ? `${day.kcal} calories logged` : 'no entries'}`}
            className={`flex min-h-touch min-w-touch flex-col items-center gap-2 rounded-xl py-2 text-caption transition-colors ${day.date === date ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-400' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
            <span>{dt.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${day.count ? 'bg-brand-700 text-white' : 'border border-dashed border-slate-300 dark:border-slate-600'}`}>{dt.getDate()}</span>
            <span className="text-[10px] tabular-nums">{day.count ? day.kcal : '-'}</span>
          </button>
        })}
      </div></div>
      <p className="text-caption text-slate-500 dark:text-slate-400">Logged calories · days may be partial</p>
    </section>
  )
}
