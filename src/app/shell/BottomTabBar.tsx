import { Link, useLocation, useNavigate } from 'react-router-dom'
import { diaryDate, todayISO } from '../../lib/date'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { useUIState } from './UIStateContext'
import { CoachIcon, ForkKnifeIcon, LogIcon, PlusIcon, TodayIcon, TrendsIcon } from './icons'

interface TabDef {
  key: string
  label: string
  to: string
  Icon: typeof TodayIcon
  isActive: (pathname: string) => boolean
}

const TABS: TabDef[] = [
  { key: 'today', label: 'Today', to: '/', Icon: TodayIcon, isActive: (p) => p === '/' },
  {
    key: 'log',
    label: 'Log',
    to: '/log',
    Icon: LogIcon,
    isActive: (p) => p.startsWith('/log') || p.startsWith('/history'),
  },
  {
    key: 'trends',
    label: 'Trends',
    to: '/trends',
    Icon: TrendsIcon,
    isActive: (p) => p.startsWith('/trends') || p.startsWith('/weight'),
  },
  {
    key: 'coach',
    label: 'Coach',
    to: '/coach',
    Icon: CoachIcon,
    isActive: (p) => p.startsWith('/coach'),
  },
]

export default function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const date = diaryDate(location.pathname.startsWith('/history/') ? location.pathname.split('/')[2] : new URLSearchParams(location.search).get('date'))
  const { openAddFoodSheet } = useUIState()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-surface-dark-card lg:inset-y-0 lg:right-auto lg:flex lg:w-52 lg:flex-col lg:border-r lg:border-t-0 lg:px-4 lg:pt-6"
      aria-label="Primary"
      data-testid="bottom-tab-bar"
    >
      <div className="mb-9 hidden px-2 lg:block">
        <Link to="/" className="flex min-h-touch items-center gap-2.5" aria-label="Bitewise home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white dark:bg-brand-400 dark:text-slate-950"><ForkKnifeIcon /></span>
          <span className="text-title font-semibold tracking-tight text-slate-900 dark:text-slate-100">Bitewise<span className="text-brand-600 dark:text-brand-400">.</span></span>
        </Link>
        <p className="mt-3 text-caption leading-relaxed text-slate-500 dark:text-slate-400">A little better, every day.</p>
      </div>
      <div className="mx-auto flex w-full max-w-md items-stretch justify-between gap-1 px-2 py-1.5 lg:flex-col lg:gap-1.5 lg:px-0 lg:py-0">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.key} tab={tab} active={tab.isActive(location.pathname)} />
        ))}

        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-0.5 lg:order-last lg:mt-6 lg:flex-none lg:py-0">
          <button
            type="button"
            onClick={() => {
              const meal = activeMealWindow(new Date()) ?? 'breakfast'
              if (date !== todayISO()) navigate(`/log/add?date=${date}&meal=${meal}`)
              else openAddFoodSheet(meal)
            }}
            aria-label="Add food"
            data-testid="fab-scan"
            className="flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-2xl bg-brand-700 text-white dark:bg-brand-400 dark:text-slate-950 lg:h-12 lg:w-full lg:gap-2 lg:rounded-xl lg:px-3"
          >
            <PlusIcon /><span className="hidden text-sm font-semibold lg:inline">Log food</span>
          </button>
          <span className="pointer-events-none text-caption font-medium text-slate-500 dark:text-slate-400 lg:hidden">Add</span>
        </div>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.key} tab={tab} active={tab.isActive(location.pathname)} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({ tab, active }: { tab: TabDef; active: boolean }) {
  const { Icon } = tab
  return (
    <Link
      to={tab.to}
      aria-current={active ? 'page' : undefined}
      data-testid={`tab-${tab.key}`}
      className={`flex min-h-touch min-w-touch flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 ${
        active ? 'text-brand-700 dark:text-brand-400 lg:bg-brand-50 lg:dark:bg-slate-800' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <span className={`flex h-8 w-11 items-center justify-center rounded-xl lg:h-auto lg:w-auto ${active ? 'bg-brand-50 dark:bg-slate-800 lg:bg-transparent lg:dark:bg-transparent' : ''}`}><Icon active={active} /></span>
      <span className={`text-caption ${active ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
    </Link>
  )
}
