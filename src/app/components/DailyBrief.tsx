import { Link } from 'react-router-dom'
import type { LogEntry } from '../../data/models'
import { addDaysISO } from '../../lib/date'
import { SparkleIcon } from '../shell/icons'

/** Local, explainable context stays useful without an AI request. */
export default function DailyBrief({ date, entries, historyEntries }: { date: string; entries: LogEntry[]; historyEntries: LogEntry[] }) {
  const days = new Set(historyEntries.filter((entry) => entry.date >= addDaysISO(date, -6) && entry.date <= date).map((entry) => entry.date)).size
  const started = entries.length > 0
  return (
    <section className="rounded-card border border-brand-100 bg-brand-50 p-5 dark:border-brand-800 dark:bg-brand-900/20" aria-labelledby="daily-brief-title">
      <div className="mb-3 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-caption font-semibold text-brand-700 dark:text-brand-400"><SparkleIcon />Your daily focus</span><span className="text-caption text-slate-500 dark:text-slate-400">{days}/7 days with logs</span></div>
      <h2 id="daily-brief-title" className="text-lg font-semibold tracking-tight">{started ? 'Make the next meal easier.' : 'Start with one meal.'}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{started ? 'Your diary is taking shape. Revisit a familiar meal, or ask your coach for an idea that fits the food you enjoy.' : 'No need to reconstruct a perfect day. Add what you remember, then build from there.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={started ? '/coach/chat?intent=next-meal' : `/log/add?date=${date}`} className="pressable flex min-h-touch items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm dark:bg-surface-dark-card dark:text-brand-400">{started ? 'Find my next meal' : 'Log my first meal'}</Link>
        <Link to="/coach" className="pressable flex min-h-touch items-center px-2 text-sm font-medium text-brand-700 dark:text-brand-400">Review my week <span aria-hidden="true" className="ml-2">→</span></Link>
      </div>
      <p className="mt-3 text-caption text-slate-500 dark:text-slate-400">Days with logs can include partial diaries.</p>
    </section>
  )
}
