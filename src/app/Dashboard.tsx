import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import type { LogEntry, Meal, Targets } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { findApplicableTarget } from '../domain/history/targetForDate'
import { sumMacros } from '../domain/logging/portionMath'
import { addDaysISO, isFutureDate, todayISO } from '../lib/date'
import AdaptiveTargetPrompt from './components/AdaptiveTargetPrompt'
import CaloriesRing from './components/CaloriesRing'
import DateNav from './components/DateNav'
import MacroBar from './components/MacroBar'
import MacroBreakdownSheet from './components/MacroBreakdownSheet'
import MealSection from './components/MealSection'
import { useUIState } from './shell/UIStateContext'

const MACRO_DEFS = {
  p: { key: 'p' as const, label: 'Protein', colorClass: 'bg-protein-500' },
  c: { key: 'c' as const, label: 'Carbs', colorClass: 'bg-carbs-500' },
  f: { key: 'f' as const, label: 'Fat', colorClass: 'bg-fat-500' },
}

type LoadState = 'loading' | 'ready' | 'no-profile'

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

const SWIPE_THRESHOLD_PX = 60

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { dataVersion } = useUIState()
  const prefersReducedMotion = useReducedMotion()

  const requestedDate = searchParams.get('date')
  const date = requestedDate && !isFutureDate(requestedDate) ? requestedDate : todayISO()
  const isToday = date === todayISO()

  const [state, setState] = useState<LoadState>('loading')
  const [targets, setTargets] = useState<Targets | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [breakdownMacro, setBreakdownMacro] = useState<(typeof MACRO_DEFS)[keyof typeof MACRO_DEFS] | null>(
    null
  )

  const logRepo = new LogRepo()

  const loadEntries = useCallback(async () => {
    const dayEntries = await logRepo.getEntriesForDate(date)
    setEntries(dayEntries)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const profileRepo = new ProfileRepo()
      const targetRepo = new TargetRepo()
      const p = await profileRepo.get()
      if (cancelled) return
      if (!p) {
        setState('no-profile')
        return
      }
      const [allTargets, dayEntries] = await Promise.all([
        targetRepo.getAll(),
        new LogRepo().getEntriesForDate(date),
      ])
      if (cancelled) return
      setTargets(findApplicableTarget(date, allTargets) ?? null)
      setEntries(dayEntries)
      setState('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [date, dataVersion])

  async function handleDelete(id: number) {
    await logRepo.deleteEntry(id)
    await loadEntries()
  }

  async function reloadTargets() {
    const t = await new TargetRepo().getLatest()
    setTargets(t ?? null)
  }

  function goToDate(newDate: string) {
    if (newDate === todayISO()) {
      setSearchParams({})
    } else {
      setSearchParams({ date: newDate })
    }
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x <= -SWIPE_THRESHOLD_PX) {
      const next = addDaysISO(date, 1)
      if (!isFutureDate(next)) goToDate(next)
    } else if (info.offset.x >= SWIPE_THRESHOLD_PX) {
      goToDate(addDaysISO(date, -1))
    }
  }

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
  }

  if (state === 'no-profile') {
    return <Navigate to="/onboarding" replace />
  }

  const totals = sumMacros(entries)
  const target = targets ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

  return (
    <div className="pb-4" data-testid="today-view">
      <DateNav date={date} onChange={goToDate} />
      {!isToday && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => goToDate(todayISO())}
            data-testid="return-to-today"
            className="min-h-touch rounded-full bg-brand-50 px-3 py-1.5 text-caption font-medium text-brand-700"
          >
            Return to today
          </button>
        </div>
      )}

      <motion.div
        className="mx-auto mt-4 max-w-md px-6 touch-pan-y"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={prefersReducedMotion ? undefined : handleDragEnd}
      >
        <div
          className="flex flex-col items-center rounded-card bg-white p-6 shadow-card"
          data-testid="targets-card"
        >
          <CaloriesRing consumedKcal={totals.kcal} targetKcal={target.kcal} />
          <p className="mt-2 text-caption text-slate-500" data-testid="kcal-target">
            {target.kcal} kcal target
          </p>

          <div className="mt-6 grid w-full grid-cols-1 gap-3">
            <MacroBar
              label="Protein"
              consumed={totals.p}
              target={target.proteinG}
              colorClass="bg-protein-500"
              testId="protein-bar"
              onTap={() => setBreakdownMacro(MACRO_DEFS.p)}
            />
            <MacroBar
              label="Carbs"
              consumed={totals.c}
              target={target.carbsG}
              colorClass="bg-carbs-500"
              testId="carbs-bar"
              onTap={() => setBreakdownMacro(MACRO_DEFS.c)}
            />
            <MacroBar
              label="Fat"
              consumed={totals.f}
              target={target.fatG}
              colorClass="bg-fat-500"
              testId="fat-bar"
              onTap={() => setBreakdownMacro(MACRO_DEFS.f)}
            />
          </div>
        </div>

        {isToday && <AdaptiveTargetPrompt onAccepted={reloadTargets} />}

        {MEALS.map(({ key, label }) => (
          <MealSection
            key={key}
            meal={key}
            label={label}
            entries={entries.filter((e) => e.meal === key)}
            onDelete={handleDelete}
            date={isToday ? undefined : date}
          />
        ))}
      </motion.div>

      <MacroBreakdownSheet
        open={breakdownMacro !== null}
        onClose={() => setBreakdownMacro(null)}
        macro={breakdownMacro}
        entries={entries}
      />
    </div>
  )
}
