import { Link } from 'react-router-dom'
import type { LogEntry } from '../../data/models'
import { ChevronRightIcon, SparkleIcon } from '../shell/icons'

/** Keep the empty diary focused on logging; offer coaching once a meal is logged. */
export default function DailyBrief({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null

  return (
    <Link
      to="/coach/chat?intent=next-meal"
      className="pressable flex min-h-touch items-center gap-3 rounded-card border border-brand-100 bg-brand-50 p-4 text-sm font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400"
    >
      <SparkleIcon />
      <span className="flex-1">Plan my next meal</span>
      <ChevronRightIcon />
    </Link>
  )
}
