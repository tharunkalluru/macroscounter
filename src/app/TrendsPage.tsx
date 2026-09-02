import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogRepo } from '../data/repos/LogRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { groupEntriesByDate } from '../domain/history/averages'
import { computeEMA } from '../domain/history/ema'
import { computeStreak } from '../domain/streaks/streak'
import { kgToLb } from '../domain/units/weight'
import { addDaysISO, todayISO } from '../lib/date'
import { CoachIcon, FlameIcon, TargetIcon, TrendsIcon } from './shell/icons'

interface HubCard {
  to: string
  label: string
  description: string
  Icon: typeof TrendsIcon
  testId: string
}

const CARDS: HubCard[] = [
  {
    to: '/weight',
    label: 'Weight',
    description: 'Your weight trend and goal ETA',
    Icon: TrendsIcon,
    testId: 'trends-card-weight',
  },
  {
    to: '/trends/expenditure',
    label: 'Expenditure',
    description: 'Your measured TDEE, not a formula',
    Icon: TargetIcon,
    testId: 'trends-card-expenditure',
  },
  {
    to: '/trends/habits',
    label: 'Habits',
    description: 'Streak, consistency, and weekly patterns',
    Icon: FlameIcon,
    testId: 'trends-card-habits',
  },
  {
    to: '/trends/report',
    label: 'Weekly report',
    description: "This week's numbers and insights",
    Icon: CoachIcon,
    testId: 'trends-card-report',
  },
]

interface LivePreview {
  weightTrendLb: number | null
  weightDeltaLb: number | null
  streak: number
  avgKcal: number | null
}

export default function TrendsPage() {
  const [preview, setPreview] = useState<LivePreview | null>(null)

  useEffect(() => {
    ;(async () => {
      const today = todayISO()
      const weekAgo = addDaysISO(today, -6)
      const [weighIns, entries, streakEntries] = await Promise.all([
        new WeighInRepo().getInRange(addDaysISO(today, -29), today),
        new LogRepo().getEntriesForDateRange(weekAgo, today),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -179), today),
      ])

      const ema = computeEMA(
        weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        7
      )
      const weightTrendLb = ema.length > 0 ? kgToLb(ema[ema.length - 1].ema) : null
      const weightDeltaLb = ema.length >= 2 ? kgToLb(ema[ema.length - 1].ema) - kgToLb(ema[0].ema) : null

      const dayTotals = groupEntriesByDate(entries)
      const avgKcal = dayTotals.length > 0 ? Math.round(dayTotals.reduce((s, d) => s + d.kcal, 0) / dayTotals.length) : null

      const loggedDates = groupEntriesByDate(streakEntries).map((d) => d.date)
      const streak = computeStreak(loggedDates, today)

      setPreview({ weightTrendLb, weightDeltaLb, streak, avgKcal })
    })()
  }, [])

  function subtitleFor(card: HubCard): string | null {
    if (!preview) return null
    if (card.testId === 'trends-card-weight' && preview.weightTrendLb !== null) {
      const delta = preview.weightDeltaLb
      return delta !== null ? `${preview.weightTrendLb} lb · ${delta <= 0 ? '' : '+'}${delta.toFixed(1)} lb` : `${preview.weightTrendLb} lb`
    }
    if (card.testId === 'trends-card-expenditure' && preview.avgKcal !== null) {
      return `~${preview.avgKcal} kcal/day logged`
    }
    if (card.testId === 'trends-card-habits' && preview.streak > 0) {
      return `${preview.streak}-day streak`
    }
    return null
  }

  return (
    <div className="mx-auto max-w-md px-6 pb-24 pt-2">
      <h1 className="sr-only">Trends</h1>

      <div className="flex flex-col gap-3">
        {CARDS.map((card) => {
          const live = subtitleFor(card)
          return (
            <Link
              key={card.to}
              to={card.to}
              data-testid={card.testId}
              className="flex min-h-touch items-center gap-3 rounded-card bg-white p-4 shadow-card transition-transform active:scale-[0.98] dark:bg-surface-dark-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400">
                <card.Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="block font-semibold text-slate-900 dark:text-slate-100">{card.label}</span>
                  {live && (
                    <span
                      className="flex-none text-caption font-medium tabular-nums text-brand-700 dark:text-brand-400"
                      data-testid={`${card.testId}-live`}
                    >
                      {live}
                    </span>
                  )}
                </span>
                <span className="block text-caption text-slate-500 dark:text-slate-400">{card.description}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
