import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import type { LogEntry, Targets } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { findApplicableTarget } from '../domain/history/targetForDate'
import { sumMacros } from '../domain/logging/portionMath'
import { daysBetween, deriveCurrentProgram } from '../domain/programs/program'
import { addDaysISO, isFutureDate, todayISO } from '../lib/date'
import { vibrateSuccess } from '../lib/haptics'
import { hasCelebratedProteinGoal, markProteinGoalCelebrated } from '../lib/logging/proteinGoalCelebration'
import { hasMadeSignInChoice } from '../lib/sync/guestMode'
import AdaptiveTargetPrompt from './components/AdaptiveTargetPrompt'
import CaloriesRing from './components/CaloriesRing'
import CopyYesterdayPrompt from './components/CopyYesterdayPrompt'
import DashboardSkeleton from './components/DashboardSkeleton'
import DateNav from './components/DateNav'
import GoalCelebration from './components/GoalCelebration'
import MacroBar from './components/MacroBar'
import MacroBreakdownSheet from './components/MacroBreakdownSheet'
import MealPromptSheet from './components/MealPromptSheet'
import TodayEntryList from './components/TodayEntryList'
import { useMealPrompt } from './hooks/useMealPrompt'
import { useUIState } from './shell/UIStateContext'

const MACRO_DEFS = {
  p: { key: 'p' as const, label: 'Protein', colorClass: 'bg-protein-500' },
  c: { key: 'c' as const, label: 'Carbs', colorClass: 'bg-carbs-500' },
  f: { key: 'f' as const, label: 'Fat', colorClass: 'bg-fat-500' },
}

type LoadState = 'loading' | 'ready' | 'no-profile' | 'welcome'

const SWIPE_THRESHOLD_PX = 60

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { dataVersion, notifyDataChanged } = useUIState()
  const prefersReducedMotion = useReducedMotion()

  const requestedDate = searchParams.get('date')
  const date = requestedDate && !isFutureDate(requestedDate) ? requestedDate : todayISO()
  const isToday = date === todayISO()

  const [state, setState] = useState<LoadState>('loading')
  const [targets, setTargets] = useState<Targets | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [historyEntries, setHistoryEntries] = useState<LogEntry[]>([])
  const [dayOfProgram, setDayOfProgram] = useState<number | null>(null)
  const [breakdownMacro, setBreakdownMacro] = useState<
    (typeof MACRO_DEFS)[keyof typeof MACRO_DEFS] | null
  >(null)

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
        const decided = await hasMadeSignInChoice()
        if (cancelled) return
        setState(decided ? 'no-profile' : 'welcome')
        return
      }
      const [allTargets, dayEntries, historyRange] = await Promise.all([
        targetRepo.getAll(),
        new LogRepo().getEntriesForDate(date),
        new LogRepo().getEntriesForDateRange(addDaysISO(date, -14), date),
      ])
      if (cancelled) return
      setTargets(findApplicableTarget(date, allTargets) ?? null)
      setEntries(dayEntries)
      setHistoryEntries(historyRange)
      if (isToday) {
        const program = deriveCurrentProgram(allTargets, date)
        setDayOfProgram(program ? daysBetween(program.startDate, date) + 1 : null)
      }
      setState('ready')
    })()
    return () => {
      cancelled = true
    }
    // isToday is derived synchronously from `date`, already a dep -- omitted
    // to avoid a redundant re-run trigger, same pattern as loadEntries above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, dataVersion])

  const mealPrompt = useMealPrompt(entries, isToday && state === 'ready')

  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    if (state !== 'ready' || !isToday || !targets || targets.proteinG <= 0) return
    const proteinEaten = sumMacros(entries).p
    if (proteinEaten < targets.proteinG) return
    if (hasCelebratedProteinGoal(date)) return
    markProteinGoalCelebrated(date)
    vibrateSuccess()
    setShowCelebration(true)
  }, [state, isToday, targets, entries, date])

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
    return <DashboardSkeleton />
  }

  if (state === 'welcome') {
    return <Navigate to="/welcome" replace />
  }

  if (state === 'no-profile') {
    return <Navigate to="/onboarding" replace />
  }

  const totals = sumMacros(entries)
  const target = targets ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

  return (
    <div className="pb-4" data-testid="today-view">
      <h1 className="sr-only">Today</h1>
      {isToday && dayOfProgram !== null && (
        <p
          className="mx-auto max-w-md px-6 pb-1 text-center text-caption text-slate-500 dark:text-slate-400"
          data-testid="today-program-header"
        >
          Day {dayOfProgram} of program
        </p>
      )}
      <DateNav date={date} onChange={goToDate} />
      {!isToday && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => goToDate(todayISO())}
            data-testid="return-to-today"
            className="min-h-touch rounded-full bg-brand-50 px-3 py-1.5 text-caption font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-400"
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
          className="flex flex-col items-center rounded-card bg-white p-6 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark"
          data-testid="targets-card"
        >
          <CaloriesRing consumedKcal={totals.kcal} targetKcal={target.kcal} />
          <p
            className="mt-2 text-caption text-slate-500 dark:text-slate-400"
            data-testid="kcal-target"
          >
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
        {isToday && (
          <CopyYesterdayPrompt
            date={date}
            todayEntryCount={entries.length}
            historyEntries={historyEntries}
            onCopied={notifyDataChanged}
          />
        )}
        {isToday && <MealPromptSheet {...mealPrompt} onLogged={notifyDataChanged} />}

        <TodayEntryList
          entries={entries}
          historyEntries={historyEntries}
          date={date}
          isToday={isToday}
          onDelete={handleDelete}
          onLogged={notifyDataChanged}
        />
      </motion.div>

      <MacroBreakdownSheet
        open={breakdownMacro !== null}
        onClose={() => setBreakdownMacro(null)}
        macro={breakdownMacro}
        entries={entries}
      />

      <GoalCelebration show={showCelebration} onDismiss={() => setShowCelebration(false)} />
    </div>
  )
}
