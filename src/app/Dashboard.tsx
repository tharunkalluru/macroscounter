import { motion, type PanInfo } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
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
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { useUIState } from './shell/UIStateContext'
import { BarcodeIcon, ForkKnifeIcon, LogIcon, PlusIcon, SparkleIcon } from './shell/icons'
import WeeklyDiaryCard from './components/WeeklyDiaryCard'
import RepeatMealsCard from './components/RepeatMealsCard'
import DailyBrief from './components/DailyBrief'

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
  const location = useLocation()
  const { dataVersion, notifyDataChanged } = useUIState()
  const prefersReducedMotion = usePrefersReducedMotion()

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

  const mealPrompt = useMealPrompt(entries, isToday && state === 'ready' && loadedDate === date && location.state?.justOnboarded !== true)

  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    if (state !== 'ready' || loadedDate !== date || !isToday || !targets || targets.proteinG <= 0) return
    const proteinEaten = sumMacros(entries).p
    if (proteinEaten < targets.proteinG) return
    if (hasCelebratedProteinGoal(date)) return
    markProteinGoalCelebrated(date)
    vibrateSuccess()
    setShowCelebration(true)
  }, [state, loadedDate, isToday, targets, entries, date])

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
    // A device that has never made a sign-in choice at all is a genuinely
    // fresh visitor -- show the marketing landing page first, not the bare
    // sign-in form. Once they've gone through /welcome once (real sign-in
    // or "Skip for now"), hasMadeSignInChoice() is true and every future
    // visit here skips straight past both screens.
    return <Navigate to="/landing" replace />
  }

  if (state === 'no-profile') {
    return <Navigate to="/onboarding" replace />
  }

  const totals = sumMacros(entries)
  const target = targets ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-4 lg:px-8" data-testid="today-view">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-display">{isToday ? 'Your day, in balance.' : 'A look at your day.'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A little awareness with every meal.</p>
        </div>
        <div className="w-full sm:w-auto">
          <DateNav date={date} onChange={goToDate} />
          {!isToday && <button type="button" onClick={() => goToDate(todayISO())} data-testid="return-to-today" className="min-h-touch w-full text-caption font-medium text-brand-700 dark:text-brand-400">Return to today</button>}
        </div>
      </div>
      <section className="mb-5 grid gap-2 sm:grid-cols-[1fr_1fr] sm:gap-3" aria-label="Logging shortcuts">
        <Link to={`/log/add?date=${date}`} className="pressable flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white">
          <span>Search & log food</span><PlusIcon />
        </Link>
        <div className="grid grid-cols-4 gap-2">
          <Link to={`/scan?date=${date}`} className="quick-action pressable"><BarcodeIcon /><span>Scan barcode</span></Link>
          <Link to={`/log/ai?date=${date}`} className="quick-action pressable"><SparkleIcon /><span>Describe meal</span></Link>
          <Link to={`/log/quick-add?date=${date}`} className="quick-action pressable"><ForkKnifeIcon /><span>Quick add</span></Link>
          <Link to={`/templates?date=${date}`} className="quick-action pressable"><LogIcon /><span>Saved meals</span></Link>
        </div>
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 space-y-5">
          <motion.div
            className="touch-pan-y rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark sm:p-6"
            drag={prefersReducedMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.08}
            onDragEnd={prefersReducedMotion ? undefined : handleDragEnd}
            data-testid="targets-card"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Daily nutrition</h2>
              {isToday && dayOfProgram !== null && <span className="rounded-full bg-slate-50 px-2.5 py-1 text-caption text-brand-700 dark:bg-slate-800 dark:text-brand-400" data-testid="today-program-header">Day {dayOfProgram} of program</span>}
            </div>
            <CaloriesRing consumedKcal={totals.kcal} targetKcal={target.kcal} />
            <p className="mt-1 text-center text-caption text-slate-500 dark:text-slate-400" data-testid="kcal-target">{targets ? `${target.kcal} kcal target` : 'No target was set for this day'}</p>
            <div className="mt-4 grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
              <MacroBar label="Protein" consumed={totals.p} target={target.proteinG} colorClass="bg-protein-500" testId="protein-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.p)} />
              <MacroBar label="Carbs" consumed={totals.c} target={target.carbsG} colorClass="bg-carbs-500" testId="carbs-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.c)} />
              <MacroBar label="Fat" consumed={totals.f} target={target.fatG} colorClass="bg-fat-500" testId="fat-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.f)} />
              <MacroBar label="Fiber" consumed={totals.fiber ?? 0} target={target.fiberG ?? fiberFallbackG} colorClass="bg-fiber-500" testId="fiber-bar" onTap={() => setBreakdownMacro(MACRO_DEFS.fiber)} />
            </div>
            <p className="mt-3 text-center text-caption text-slate-500 dark:text-slate-400">Tap a nutrient to see which foods contributed.</p>
          </motion.div>
          <RepeatMealsCard date={date} entries={historyEntries} onLogged={notifyDataChanged} />
          {isToday && <AdaptiveTargetPrompt onAccepted={reloadTargets} />}
        </div>
        <div className="min-w-0 space-y-5">
          {isToday && <CopyYesterdayPrompt date={date} todayEntryCount={entries.length} historyEntries={historyEntries} onCopied={notifyDataChanged} />}
          <TodayEntryList entries={entries} historyEntries={historyEntries} date={date} isToday={isToday} onDelete={handleDelete} onLogged={notifyDataChanged} />
          <WeeklyDiaryCard date={date} entries={historyEntries} onSelect={goToDate} />
          {isToday && <DailyBrief date={date} entries={entries} historyEntries={historyEntries} />}
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
