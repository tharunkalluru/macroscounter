import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { Meal } from '../data/models'
import type { FoodItemResult } from '../../api/ai/analyze'
import { LogRepo } from '../data/repos/LogRepo'
import { todayISO } from '../lib/date'
import { vibrateSuccess } from '../lib/haptics'
import PageHeader from './components/PageHeader'
import { useUIState } from './shell/UIStateContext'

interface LocationState {
  meal: Meal
  items: FoodItemResult[]
}

function isLocationState(state: unknown): state is LocationState {
  return !!state && typeof state === 'object' && Array.isArray((state as LocationState).items)
}

export default function AiLogResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notifyDataChanged } = useUIState()
  const [saving, setSaving] = useState(false)

  const valid = isLocationState(location.state)
  const meal: Meal = valid ? location.state.meal : 'breakfast'
  const items: FoodItemResult[] = valid ? location.state.items : []
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => true))

  if (!valid) {
    return <Navigate to="/log/ai" replace />
  }

  const selectedCount = checked.filter(Boolean).length
  const totalKcal = items.reduce((sum, item, i) => (checked[i] ? sum + item.kcal : sum), 0)

  function toggle(i: number) {
    setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)))
  }

  async function handleLogAll() {
    setSaving(true)
    try {
      const logRepo = new LogRepo()
      for (let i = 0; i < items.length; i++) {
        if (!checked[i]) continue
        const item = items[i]
        await logRepo.addEntry({
          date: todayISO(),
          meal,
          customSnapshot: { name: item.name, kcal: item.kcal, p: item.proteinG, c: item.carbsG, f: item.fatG },
          name: item.name,
          portionSummary: item.gramsEstimate ? `${item.gramsEstimate} g (AI estimate)` : 'AI estimate',
          qty: 1,
          unit: 'portion',
          grams: item.gramsEstimate ?? 0,
          kcal: item.kcal,
          p: item.proteinG,
          c: item.carbsG,
          f: item.fatG,
        })
      }
      vibrateSuccess()
      notifyDataChanged()
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <PageHeader
        title={items.length === 0 ? 'No items found' : `${items.length} item${items.length === 1 ? '' : 's'} found`}
        backTo="/log/ai"
      />

      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Couldn't identify anything from that — try describing it differently or taking another photo.
        </p>
      ) : (
        <>
          <div className="mb-4 rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800">
            <p className="text-caption text-slate-500 dark:text-slate-400">Plate total</p>
            <p className="text-title font-semibold tabular-nums text-brand-700 dark:text-brand-400">{totalKcal} kcal</p>
          </div>

          <div className="flex flex-col gap-2" data-testid="ai-result-list">
            {items.map((item, i) => (
              <button
                key={`${item.name}-${i}`}
                type="button"
                onClick={() => toggle(i)}
                data-testid={`ai-result-item-${i}`}
                aria-pressed={checked[i]}
                className={`flex min-h-touch items-center gap-3 rounded-card border p-3.5 text-left ${
                  item.confidence === 'low'
                    ? 'border-over-500 bg-over-50 dark:bg-over-900/20'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface-dark-card'
                }`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                    checked[i] ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'
                  }`}
                  aria-hidden="true"
                >
                  {checked[i] ? '✓' : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-caption text-slate-500 dark:text-slate-400">
                    {item.kcal} kcal · {item.proteinG}P {item.carbsG}C {item.fatG}F
                    {item.confidence === 'low' && (
                      <span className="ml-1 text-over-700 dark:text-over-400">· size estimated</span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-3 text-caption text-slate-500 dark:text-slate-400">
            AI-estimated, not looked up in the food database — edit quantities from the food log after logging if
            needed.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={handleLogAll}
        disabled={saving || selectedCount === 0}
        data-testid="ai-log-all-button"
        className="mt-auto min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? 'Logging…' : `Log all ${selectedCount}`}
      </button>
    </div>
  )
}
