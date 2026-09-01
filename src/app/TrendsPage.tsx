import { Link } from 'react-router-dom'
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

export default function TrendsPage() {
  return (
    <div className="mx-auto max-w-md px-6 pb-24 pt-2">
      <h1 className="sr-only">Trends</h1>

      <div className="flex flex-col gap-3">
        {CARDS.map(({ to, label, description, Icon, testId }) => (
          <Link
            key={to}
            to={to}
            data-testid={testId}
            className="flex min-h-touch items-center gap-3 rounded-card bg-white p-4 shadow-card transition-transform active:scale-[0.98] dark:bg-surface-dark-card"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900 dark:text-slate-100">{label}</span>
              <span className="block text-caption text-slate-500 dark:text-slate-400">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
