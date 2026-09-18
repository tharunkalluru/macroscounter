import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogEntry, Meal } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { computeMealSuggestions, type SuggestionChip } from '../../domain/logging/suggestions'
import { addDaysISO, todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { logSuggestionChip } from '../../lib/logging/logSuggestionChip'
import type { MealPromptControls } from '../hooks/useMealPrompt'
import { useUIState } from '../shell/UIStateContext'
import BottomSheet from '../shell/BottomSheet'
import MealSuggestionRow from './MealSuggestionRow'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  snacks: 'snacks',
  dinner: 'dinner',
}

const HISTORY_WINDOW_DAYS = 14
const MAX_SUGGESTIONS = 3

interface Props extends MealPromptControls {
  onLogged: () => void
}

export default function MealPromptSheet({ meal, dismiss, close, onLogged }: Props) {
  const { openAddFoodSheet } = useUIState()
  const [historyEntries, setHistoryEntries] = useState<LogEntry[]>([])
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!meal) return
    setError(null)
    let cancelled = false
    ;(async () => {
      const today = todayISO()
      const range = await new LogRepo().getEntriesForDateRange(
        addDaysISO(today, -HISTORY_WINDOW_DAYS),
        addDaysISO(today, -1)
      )
      if (!cancelled) setHistoryEntries(range)
    })()
    return () => {
      cancelled = true
    }
  }, [meal])

  const suggestions = useMemo(
    () => (meal ? computeMealSuggestions(historyEntries, meal, todayISO(), HISTORY_WINDOW_DAYS, MAX_SUGGESTIONS) : []),
    [historyEntries, meal]
  )

  async function handleChipTap(chip: SuggestionChip) {
    if (!meal || saving.current) return
    saving.current = true
    setPending(true)
    setError(null)
    try {
      await logSuggestionChip(chip, meal, todayISO())
      vibrateTiny()
      close()
      onLogged()
    } catch {
      setError('Could not add this meal. Nothing was added; please try again.')
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  function handleSearch() {
    if (!meal) return
    close()
    openAddFoodSheet(meal)
  }

  function handleScan() {
    if (!meal) return
    close()
    openAddFoodSheet(meal, { startOnScan: true })
  }

  return (
    <BottomSheet open={!!meal} onClose={dismiss} title={meal ? `Log ${MEAL_LABELS[meal]}?` : ''}>
      <div className="flex flex-col gap-4 pb-4" data-testid="meal-prompt-sheet">
        {error && <p role="alert" className="text-sm text-danger-700 dark:text-danger-300">{error}</p>}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((chip) => (
              <MealSuggestionRow
                key={chip.key}
                chip={chip}
                onAdd={() => handleChipTap(chip)}
                disabled={pending}
                addTestId="meal-prompt-suggestion-chip"
              />
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSearch}
            data-testid="meal-prompt-search-button"
            className="min-h-touch flex-1 rounded bg-brand-700 px-4 py-2 font-medium text-white"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleScan}
            data-testid="meal-prompt-scan-button"
            className="min-h-touch flex-1 rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            Scan
          </button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          data-testid="meal-prompt-not-now-button"
          className="min-h-touch self-center text-sm text-slate-500 underline dark:text-slate-400"
        >
          Not now
        </button>
      </div>
    </BottomSheet>
  )
}
