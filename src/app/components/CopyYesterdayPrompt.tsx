import { useState } from 'react'
import type { LogEntry } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { buildCopiedEntries } from '../../domain/logging/copyEntries'
import { shouldOfferDayCopy, summarizeDayCopy } from '../../domain/logging/dayCopy'
import { addDaysISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'

interface Props {
  /** Today's date (the copy target), ISO. */
  date: string
  /** Number of entries already logged today, across all meals. */
  todayEntryCount: number
  /** Trailing history window (as loaded for suggestion chips) to pull yesterday's entries from. */
  historyEntries: LogEntry[]
  onCopied: () => void
}

export default function CopyYesterdayPrompt({ date, todayEntryCount, historyEntries, onCopied }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [copying, setCopying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yesterday = addDaysISO(date, -1)
  const previousDayEntries = historyEntries.filter((e) => e.date === yesterday)

  if (dismissed || !shouldOfferDayCopy(todayEntryCount, previousDayEntries)) return null

  const { count, kcal } = summarizeDayCopy(previousDayEntries)

  async function handleCopy() {
    if (copying) return
    setCopying(true)
    setError(null)
    try {
      const copies = buildCopiedEntries(previousDayEntries, date)
      const logRepo = new LogRepo()
      await logRepo.addEntries(copies)
      vibrateTiny()
      onCopied()
    } catch {
      setError('Could not copy your meals. Nothing was added; please try again.')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div
      className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800"
      data-testid="copy-yesterday-prompt"
    >
      <p className="font-medium text-brand-700 dark:text-brand-400">Same meals as yesterday?</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        {count} item{count === 1 ? '' : 's'} · {kcal} kcal
      </p>
      {error && <p role="alert" className="mt-2 text-danger-700 dark:text-danger-300">{error}</p>}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={copying}
          onClick={handleCopy}
          data-testid="copy-yesterday-confirm"
          className="min-h-touch rounded bg-brand-700 px-3 py-1 font-medium text-white disabled:opacity-50"
        >
          Copy yesterday
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          data-testid="copy-yesterday-dismiss"
          className="min-h-touch rounded px-3 py-1 text-slate-500 underline dark:text-slate-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
