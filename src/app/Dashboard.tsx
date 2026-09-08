import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import type { LogEntry, Targets } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { computeFiberTarget } from '../domain/goals/goalEngine'
import { findApplicableTarget } from '../domain/history/targetForDate'
import { sumMacros } from '../domain/logging/portionMath'
import { daysBetween, deriveCurrentProgram } from '../domain/programs/program'
import { addDaysISO, diaryDate, isFutureDate, todayISO } from '../lib/date'
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
import { BarcodeIcon, ForkKnifeIcon, PlusIcon, SparkleIcon } from './shell/icons'
import WeeklyDiaryCard from './components/WeeklyDiaryCard'

const MACRO_DEFS = {
  p: { key: 'p' as const, label: 'Protein', colorClass: 'bg-protein-500' },
  c: { key: 'c' as const, label: 'Carbs', colorClass: 'bg-carbs-500' },
  f: { key: 'f' as const, label: 'Fat', colorClass: 'bg-fat-500' },
  fiber: { key: 'fiber' as const, label: 'Fiber', colorClass: 'bg-fiber-500' },
}

type LoadState = 'loading' | 'ready' | 'no-profile' | 'welcome'

const SWIPE_THRESHOLD_PX = 60

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { dataVersion, notifyDataChanged } = useUIState()
  const prefersReducedMotion = useReducedMotion()

  const requestedDate = searchParams.get('date')
  const date = diaryDate(requestedDate)
  const isToday = date === todayISO()

  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [state, setState] = useState<LoadState>('loading')
  const [targets, setTargets] = useState<Targets | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [historyEntries, setHistoryEntries] = useState<LogEntry[]>([])
  const [dayOfProgram, setDayOfProgram] = useState<number | null>(null)
  // Fiber-target fallback for accounts whose current target row predates
  // fiber tracking (fiberG is a nullable, non-backfilled column) -- computed
  // live from the profile rather than left at 0, so switching to fiber
  // tracking doesn't leave existing users looking like they have no target
  // until their next recalculation (Settings save, weekly check-in, etc).
  const [fiberFallbackG, setFiberFallbackG] = useState(0)
  const [breakdownMacro, setBreakdownMacro] = useState<
    (typeof MACRO_DEFS)[keyof typeof MACRO_DEFS] | null
  >(null)

  const logRepo = new LogRepo()


  useEffect(() => {
    let cancelled = false
    setLoadError(false)
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
      setFiberFallbackG(computeFiberTarget(p.sex, p.age))
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
      setLoadedDate(date)
      setState('ready')
    })().catch(() => { if (!cancelled) setLoadError(true) })
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
    notifyDataChanged()
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

  if (loadError) return <div className="mx-auto max-w-md p-6" role="alert"><p>Your diary could not be loaded.</p><button type="button" className="mt-3 min-h-touch rounded-lg bg-brand-700 px-4 text-white" onClick={notifyDataChanged}>Try again</button></div>

  if (state === 'loading' || (state === 'ready' && loadedDate !== date)) {
    return <DashboardSkeleton />
  }

  if (state === 'welcome') {
    return <Navigate to="/welcome" replace />
  }

  if (state === 'no-profile') {
    return <Navigate to="/onboarding" replace />
  }

  const totals = sumMacros(entries)
  const target = targets ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-4 lg:px-8" data-testid="today-view">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-caption font-medium uppercase tracking-widest text-brand-700 dark:text-brand-400">Your daily overview</p>
          <h1 className="text-display tracking-tight">{isToday ? 'Make today count.' : 'A look at your day.'}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Small habits. A clearer picture of your nutrition.</p>
        </div>
        <div>
          <DateNav date={date} onChange={goToDate} />
          {!isToday && <button type="button" onClick={() => goToDate(todayISO())} data-testid="return-to-today" className="min-h-touch w-full text-caption font-medium text-brand-700 dark:text-brand-400">Return to today</button>}
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <motion.div
            className="touch-pan-y rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark sm:p-6"
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.08}
            onDragEnd={prefersReducedMotion ? undefined : handleDragEnd}
            data-testid="targets-card"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Daily nutrition</h2>
              {isToday && dayOfProgram !== null && <span className="rounded-full bg-brand-50 px-3 py-1 text-caption text-brand-700 dark:bg-slate-800 dark:text-brand-400" data-testid="today-program-header">Day {dayOfProgram} of program</span>}
            </div>
            <CaloriesRing consumedKcal={totals.kcal} targetKcal={target.kcal} />
            <p className="mt-3 text-center text-caption text-slate-500 dark:text-slate-400" data-testid="kcal-target">{targets ? `${target.kcal} kcal target` : 'No target was set for this day'}</p>
            <div className="mt-5 grid w-full grid-cols-1 gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
              <MacroBar label="Protein" consumed={totals.p} target={target.proteinG} colorClass="bg-protein-500" testId="protein-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.p)} />
              <MacroBar label="Carbs" consumed={totals.c} target={target.carbsG} colorClass="bg-carbs-500" testId="carbs-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.c)} />
              <MacroBar label="Fat" consumed={totals.f} target={target.fatG} colorClass="bg-fat-500" testId="fat-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.f)} />
              <MacroBar label="Fiber" consumed={totals.fiber ?? 0} target={target.fiberG ?? fiberFallbackG} colorClass="bg-fiber-500" testId="fiber-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.fiber)} />
            </div>
            <p className="mt-2 text-center text-caption text-slate-500 dark:text-slate-400">Tap a nutrient to see which foods contributed.</p>
          </motion.div>
          <WeeklyDiaryCard date={date} entries={historyEntries} onSelect={goToDate} />
          {isToday && <AdaptiveTargetPrompt onAccepted={reloadTargets} />}
        </div>
        <div className="min-w-0 space-y-5">
          <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card" aria-label="Logging shortcuts">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">What did you eat?</h2><span className="text-caption text-slate-500 dark:text-slate-400">{isToday ? 'Today' : date}</span></div>
            <Link to={`/log/add?date=${date}`} className="flex min-h-touch items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-600"><PlusIcon /> Search & log food</Link>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Link to={`/scan?date=${date}`} className="quick-action"><BarcodeIcon /><span>Scan barcode</span></Link>
              <Link to={`/log/ai?date=${date}`} className="quick-action"><SparkleIcon /><span>Describe meal</span></Link>
              <Link to={`/log/quick-add?date=${date}`} className="quick-action"><ForkKnifeIcon /><span>Quick add</span></Link>
            </div>
            <Link to={`/templates?date=${date}`} className="mt-3 flex min-h-touch items-center justify-between border-t border-slate-100 pt-2 text-sm font-medium text-brand-700 dark:border-slate-700 dark:text-brand-400"><span>Saved meals</span><span aria-hidden="true">→</span></Link>
          </section>
          {isToday && <CopyYesterdayPrompt date={date} todayEntryCount={entries.length} historyEntries={historyEntries} onCopied={notifyDataChanged} />}
          <TodayEntryList entries={entries} historyEntries={historyEntries} date={date} isToday={isToday} onDelete={handleDelete} onLogged={notifyDataChanged} />
        </div>
      </div>
      {isToday && <MealPromptSheet {...mealPrompt} onLogged={notifyDataChanged} />}

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
