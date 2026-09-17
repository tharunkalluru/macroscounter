import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { LogRepo } from '../data/repos/LogRepo'
import { fetchAdaptiveRecommendation } from '../lib/adaptive/fetchAdaptiveRecommendation'
import { DIET_STYLE_OPTIONS } from '../domain/goals/onboardingOptions'
import { deriveCurrentProgram, type CurrentProgram } from '../domain/programs/program'
import { projectGoalWeight } from '../domain/goals/weightProjection'
import { kgToLb } from '../domain/units/weight'
import { addDaysISO, todayISO } from '../lib/date'
import { useUIState } from './shell/UIStateContext'
import { CoachIcon, SparkleIcon, ChevronRightIcon } from './shell/icons'

interface Loaded {
  program: CurrentProgram | null
  dietStyleLabel: string | null
  budgetKcal: number | null
  proteinG: number | null
  checkInDue: boolean
  days: { date: string; logged: boolean }[]
  loggedDays: number
  weighIns: number
  avgKcal: number | null
  avgProtein: number | null
  goalLabel: string
  focus: { title: string; detail: string; action: string; to: string }
  goal: { start: number; now: number; target: number; unit: string; pct: number; projectedDate: string | null } | null
}

export default function CoachPage() {
  const { dataVersion } = useUIState()
  const [state, setState] = useState<Loaded | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    ;(async () => {
      const today = todayISO()
      const weekStart = addDaysISO(today, -6)
      const [profile, targets, weighIns, adaptive, entries] = await Promise.all([
        new ProfileRepo().get(), new TargetRepo().getAll(), new WeighInRepo().getAll(),
        fetchAdaptiveRecommendation(), new LogRepo().getEntriesForDateRange(weekStart, today),
      ])
      if (cancelled) return
      const program = deriveCurrentProgram(targets, today)
      const applicableTargets = targets.filter((target) => target.effectiveDate <= today)
      const latestTarget = applicableTargets[applicableTargets.length - 1]
      const dietStyleLabel = profile?.dietStyle ? DIET_STYLE_OPTIONS.find((option) => option.value === profile.dietStyle)?.label ?? null : null
      const dates = new Set(entries.map((entry) => entry.date))
      const days = Array.from({ length: 7 }, (_, index) => { const date = addDaysISO(weekStart, index); return { date, logged: dates.has(date) } })
      const weekWeighIns = weighIns.filter((point) => point.date >= weekStart && point.date <= today).length
      const loggedDays = dates.size
      const avgKcal = loggedDays ? Math.round(entries.reduce((sum, entry) => sum + entry.kcal, 0) / loggedDays) : null
      const avgProtein = loggedDays ? Math.round(entries.reduce((sum, entry) => sum + entry.p, 0) / loggedDays) : null
      const goalLabel = profile?.goal === 'maintain' ? 'Maintain weight' : profile?.goal === 'gain' ? 'Gain steadily' : 'Lose steadily'
      let goal: Loaded['goal'] = null
      const points = weighIns.filter((point) => point.date <= today).sort((a, b) => a.date.localeCompare(b.date))
      if (profile?.goalWeightKg && points.length > 0) {
        const unit = profile.weightUnit ?? 'kg'
        const convert = (value: number) => unit === 'lb' ? kgToLb(value) : value
        const start = points[0].weightKg
        const now = points[points.length - 1].weightKg
        const target = profile.goalWeightKg
        const distance = target - start
        const pct = Math.abs(distance) < 0.01 ? (Math.abs(now - target) < 0.3 ? 100 : 0) : Math.max(0, Math.min(100, Math.round((now - start) / distance * 100)))
        const projection = projectGoalWeight(points, target, today)
        goal = { start: convert(start), now: convert(now), target: convert(target), unit, pct, projectedDate: projection.status === 'on-track' ? projection.projectedDate ?? null : null }
      }
      const focus: Loaded['focus'] = loggedDays === 0
        ? { title: 'Start with one meal.', detail: 'A useful week starts with what you ate. Search, scan, or describe it in your own words.', action: 'Log your first meal', to: '/log/add' }
        : loggedDays < 7
          ? { title: 'Make the picture a little clearer.', detail: `You have entries on ${loggedDays} of 7 days. Add anything you remember; missing meals are not zero intake.`, action: 'Review your diary', to: '/log' }
          : weekWeighIns < 2
            ? { title: 'Add a weight check when it suits you.', detail: 'Two weigh-ins at least three days apart help put logged intake in context. Daily fluctuations are normal.', action: 'Add a weigh-in', to: '/weight/entry' }
            : { title: 'Turn your week into one useful step.', detail: 'Review your logged meals and weight trend before deciding whether your targets need a change.', action: 'Review this week', to: '/coach/check-in' }
      setState({ program, dietStyleLabel, budgetKcal: latestTarget?.kcal ?? null, proteinG: latestTarget?.proteinG ?? null, checkInDue: Boolean(adaptive.review) && !adaptive.alreadyAppliedThisWeek, days, loggedDays, weighIns: weekWeighIns, avgKcal, avgProtein, goalLabel, focus, goal })
    })().catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [dataVersion])

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8">
      <p className="text-caption font-medium uppercase tracking-widest text-brand-700 dark:text-brand-400">Your personal guide</p>
      <h1 className="mt-1 text-display">A little clearer, every week.</h1>
      <p className="mb-6 mt-2 max-w-xl text-sm text-slate-500 dark:text-slate-400">A useful next step, grounded in what you have actually logged.</p>
      {error && <p role="alert" className="mb-4 text-sm text-danger-700 dark:text-danger-300">Could not load your week. Reload to try again.</p>}
      {!state && !error && <p role="status" className="text-sm text-slate-500">Loading your week…</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-5">
          {state && <section className="rounded-card bg-brand-50 p-5 shadow-card dark:bg-brand-900/20 dark:shadow-card-dark" data-testid="coach-week-brief">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Your week so far</h2><span className="text-caption font-medium text-brand-700 dark:text-brand-400">{state.loggedDays}/7 days with entries</span></div>
            <div className="my-5 overflow-x-auto"><div className="grid min-w-[332px] grid-cols-7 gap-1">
              {state.days.map((day) => <Link key={day.date} to={`/log?date=${day.date}`} aria-label={`${day.date}, ${day.logged ? 'has food entries' : 'no entries'}`} className="pressable flex min-h-touch flex-col items-center justify-center gap-2 rounded-xl py-2 text-caption">
                <span className="text-slate-500 dark:text-slate-400">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${day.logged ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`} aria-hidden="true">{day.logged ? '✓' : new Date(`${day.date}T12:00:00`).getDate()}</span>
              </Link>)}
            </div></div>
            <div className="grid grid-cols-3 gap-2 border-t border-brand-100 pt-4 dark:border-slate-700">
              <div><p className="text-xl font-semibold tabular-nums">{state.avgKcal ?? '—'}</p><p className="text-caption text-slate-500 dark:text-slate-400">avg logged kcal</p></div>
              <div><p className="text-xl font-semibold tabular-nums">{state.avgProtein === null ? '—' : `${state.avgProtein} g`}</p><p className="text-caption text-slate-500 dark:text-slate-400">avg logged protein</p></div>
              <div><p className="text-xl font-semibold tabular-nums">{state.weighIns}</p><p className="text-caption text-slate-500 dark:text-slate-400">weigh-ins</p></div>
            </div>
            <p className="mt-4 text-caption text-slate-500 dark:text-slate-400">Averages include days with entries. They may reflect only part of what you ate.</p>
          </section>}
          {state && <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark" data-testid="coach-next-step">
            <p className="text-caption font-medium uppercase tracking-widest text-brand-700 dark:text-brand-400">One next step</p><h2 className="mt-2 text-title">{state.focus.title}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{state.focus.detail}</p>
            <Link to={state.focus.to} className="pressable mt-4 inline-flex min-h-touch items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-medium text-white">{state.focus.action}<ChevronRightIcon className="h-4 w-4" /></Link>
          </section>}
          <Link to="/coach/chat?intent=week-review" data-testid="ask-coach-link" className="pressable flex min-h-touch items-center gap-3 rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"><SparkleIcon /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">Ask your coach</span><span className="mt-1 block text-caption text-slate-500 dark:text-slate-400">Make sense of a meal, your targets, or a pattern you noticed.</span></span><ChevronRightIcon className="h-4 w-4 shrink-0" />
          </Link>
        </div>
        <div className="min-w-0 space-y-5">
          <Link to="/coach/check-in" data-testid="start-check-in" className="pressable flex min-h-touch items-center gap-3 rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"><CoachIcon /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{state?.checkInDue ? 'Your weekly review is ready' : 'Weekly check-in'}</span><span className="mt-1 block text-caption text-slate-500 dark:text-slate-400">Review your evidence before changing a target.</span></span><ChevronRightIcon className="h-4 w-4 shrink-0" />
          </Link>
          {state?.program && <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark" data-testid="strategy-card">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Your current plan</h2><span className="text-caption text-slate-500 dark:text-slate-400" data-testid="strategy-week">Week {state.program.weekNumber}</span></div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{state.goalLabel}{state.dietStyleLabel ? ` · ${state.dietStyleLabel}` : ''}</p>
            <div className="mt-4 flex gap-8"><div><p className="text-xl font-semibold tabular-nums">{state.budgetKcal ?? '—'}</p><p className="text-caption text-slate-500 dark:text-slate-400">daily kcal target</p></div><div><p className="text-xl font-semibold tabular-nums">{state.proteinG ?? '—'} g</p><p className="text-caption text-slate-500 dark:text-slate-400">protein target</p></div></div>
            {state.program.pastProgramsCount > 0 && <p className="mt-3 text-caption text-slate-500 dark:text-slate-400" data-testid="strategy-past-programs">Past programs: {state.program.pastProgramsCount}</p>}
            <Link to="/settings" data-testid="strategy-edit-program" className="mt-2 inline-flex min-h-touch items-center text-caption font-medium text-brand-700 dark:text-brand-400">Edit program <span aria-hidden="true" className="ml-1">→</span></Link>
          </section>}
          {state?.goal && <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark" data-testid="strategy-goal-section">
            <h2 className="font-semibold">Your weight goal</h2><div className="my-4 grid grid-cols-3 gap-2">{[['Start', state.goal.start], ['Now', state.goal.now], ['Goal', state.goal.target]].map(([label, value]) => <div key={label}><p className="text-caption text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 font-semibold tabular-nums">{Number(value).toFixed(1)} <span className="text-caption font-normal">{state.goal!.unit}</span></p></div>)}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-brand-600" style={{ width: `${state.goal.pct}%` }} /></div><p className="mt-3 text-caption text-slate-500 dark:text-slate-400">{state.goal.pct}% of the way from your first weigh-in{state.goal.projectedDate ? ` · estimated goal date ${state.goal.projectedDate}` : ''}</p>
          </section>}
        </div>
      </div>
    </div>
  )
}
