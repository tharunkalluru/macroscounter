import { Link, useLocation, useNavigate } from 'react-router-dom'
import { diaryDate, todayISO } from '../../lib/date'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { useUIState } from './UIStateContext'
import { CoachIcon, LogIcon, PlusIcon, TodayIcon, TrendsIcon } from './icons'

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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-surface-dark-card lg:inset-y-0 lg:right-auto lg:w-52 lg:border-r lg:border-t-0 lg:px-4 lg:pt-8"
      aria-label="Primary"
      data-testid="bottom-tab-bar"
    >
      <div className="mb-10 hidden px-3 lg:block"><p className="text-title font-bold text-brand-700 dark:text-brand-400">Bitewise<span className="text-brand-500">.</span></p><p className="mt-1 text-caption text-slate-500 dark:text-slate-400">A little better, every day.</p></div>
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 lg:flex-col lg:gap-2 lg:px-0">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.key} tab={tab} active={tab.isActive(location.pathname)} />
        ))}

        <div className="relative flex flex-1 items-center justify-center lg:order-last lg:mt-6 lg:flex-none">
          <button
            type="button"
            onClick={() => {
              const meal = activeMealWindow(new Date()) ?? 'breakfast'
              if (date !== todayISO()) navigate(`/log/add?date=${date}&meal=${meal}`)
              else openAddFoodSheet(meal)
            }}
            aria-label="Add food"
            data-testid="fab-scan"
            className="absolute -top-6 flex min-h-touch min-w-touch flex-col items-center justify-center rounded-full bg-brand-600 p-4 text-white shadow-card active:scale-95 lg:static lg:w-full lg:flex-row lg:gap-2 lg:rounded-xl lg:p-3"
          >
            <PlusIcon /><span className="hidden text-sm font-semibold lg:inline">Log food</span>
          </button>
          <span className="pointer-events-none mt-8 lg:hidden text-caption text-slate-500 dark:text-slate-400">Add</span>
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
      className={`flex min-h-touch min-w-touch flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-colors hover:bg-brand-50 dark:hover:bg-slate-800 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3 ${
        active ? 'text-brand-700 dark:text-brand-400 lg:bg-brand-50 lg:dark:bg-slate-800' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon active={active} />
      <span className="text-caption">{tab.label}</span>
    </Link>
  )
}
