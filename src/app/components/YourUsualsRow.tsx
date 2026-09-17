import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry, Meal } from '../../data/models'
import { computeMealSuggestions } from '../../domain/logging/suggestions'
import { vibrateTiny } from '../../lib/haptics'
import { logSuggestionChip } from '../../lib/logging/logSuggestionChip'

interface Props {
  meal: Meal
  date: string
  historyEntries: LogEntry[]
  onLogged: () => void
}

/**
 * Always-visible one-tap "your usual?" row for the currently-active meal
 * window (Phase R.3) — reuses `computeMealSuggestions`/`logSuggestionChip`,
 * the exact ranking + logging MealSection's empty-state chips already use.
 * Renders nothing once there's no suggestion to show.
 */
export default function YourUsualsRow({ meal, date, historyEntries, onLogged }: Props) {
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suggestions = useMemo(
    () => computeMealSuggestions(historyEntries, meal, date),
    [historyEntries, meal, date]
  )

  if (suggestions.length === 0) return null

  async function handleTap(chip: (typeof suggestions)[number]) {
    if (saving.current) return
    saving.current = true
    setPending(true)
    setError(null)
    try {
      await logSuggestionChip(chip, meal, date)
      vibrateTiny()
      onLogged()
    } catch {
      setError('Could not add this meal. Nothing was added; try again.')
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2" data-testid="your-usuals-row">
      <div className="flex items-center justify-between">
        <p className="text-caption text-slate-500 dark:text-slate-400">Your usual?</p>
        <Link to={`/log/usuals?date=${date}&meal=${meal}`} data-testid="your-usuals-see-all" className="min-h-touch text-caption font-medium text-brand-700 dark:text-brand-400">
          See all
        </Link>
      </div>
      {error && <p role="alert" className="text-caption text-danger-700 dark:text-danger-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => handleTap(chip)}
            disabled={pending}
            data-testid="suggestion-chip"
            className="min-h-touch rounded-full border border-brand-700 px-3 py-1 text-caption text-brand-700 dark:border-brand-400 dark:text-brand-400"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
