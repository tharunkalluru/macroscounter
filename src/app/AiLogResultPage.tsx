import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { todayISO } from '../lib/date'
import { vibrateSuccess } from '../lib/haptics'
import PageHeader from './components/PageHeader'
import { useUIState } from './shell/UIStateContext'

interface StubItem {
  name: string
  kcal: number
  p: number
  c: number
  f: number
  uncertain?: boolean
}

/** A fixed, clearly-labeled example result — not a real analysis of anything the user typed or photographed (see AiLogPage). */
const STUB_ITEMS: StubItem[] = [
  { name: 'Mixed home-style meal (estimated)', kcal: 420, p: 18, c: 52, f: 14 },
  { name: 'Side item (estimated)', kcal: 90, p: 2, c: 12, f: 3, uncertain: true },
]

export default function AiLogResultPage() {
  const navigate = useNavigate()
  const { notifyDataChanged } = useUIState()
  const [searchParams] = useSearchParams()
  const meal = (searchParams.get('meal') as Meal) ?? 'breakfast'
  const [checked, setChecked] = useState<boolean[]>(STUB_ITEMS.map(() => true))
  const [saving, setSaving] = useState(false)

  const selectedCount = checked.filter(Boolean).length
  const totalKcal = STUB_ITEMS.reduce((sum, item, i) => (checked[i] ? sum + item.kcal : sum), 0)

  function toggle(i: number) {
    setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)))
  }

  async function handleLogAll() {
    setSaving(true)
    try {
      const logRepo = new LogRepo()
      for (let i = 0; i < STUB_ITEMS.length; i++) {
        if (!checked[i]) continue
        const item = STUB_ITEMS[i]
        await logRepo.addEntry({
          date: todayISO(),
          meal,
          customSnapshot: { name: item.name, kcal: item.kcal, p: item.p, c: item.c, f: item.f },
          name: item.name,
          portionSummary: 'AI preview',
          qty: 1,
          unit: 'portion',
          grams: 0,
          kcal: item.kcal,
          p: item.p,
          c: item.c,
          f: item.f,
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
      <PageHeader title={`${STUB_ITEMS.length} items found`} backTo="/log/ai" />

      <div className="mb-4 rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800">
        <p className="text-caption text-slate-500 dark:text-slate-400">Plate total</p>
        <p className="text-title font-semibold tabular-nums text-brand-700 dark:text-brand-400">{totalKcal} kcal</p>
      </div>

      <div className="flex flex-col gap-2" data-testid="ai-result-list">
        {STUB_ITEMS.map((item, i) => (
          <button
            key={item.name}
            type="button"
            onClick={() => toggle(i)}
            data-testid={`ai-result-item-${i}`}
            aria-pressed={checked[i]}
            className={`flex min-h-touch items-center gap-3 rounded-card border p-3.5 text-left ${
              item.uncertain
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
                {item.kcal} kcal · {item.p}P {item.c}C {item.f}F
                {item.uncertain && <span className="ml-1 text-over-700 dark:text-over-400">· size uncertain</span>}
              </p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-3 text-caption text-slate-400 dark:text-slate-500">
        Example result — AI logging is still in preview, so nothing here was actually derived from what you
        described. Edit quantities from the food log after logging if needed.
      </p>

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
