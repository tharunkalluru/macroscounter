import { Link, useLocation } from 'react-router-dom'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { useUIState } from './UIStateContext'
import { HistoryIcon, ScanIcon, SettingsIcon, TodayIcon, TrendsIcon } from './icons'

interface TabDef {
  key: string
  label: string
  to: string
  Icon: typeof TodayIcon
  isActive: (pathname: string) => boolean
}

const TABS: TabDef[] = [
  { key: 'today', label: 'Today', to: '/', Icon: TodayIcon, isActive: (p) => p === '/' },
  { key: 'history', label: 'History', to: '/history', Icon: HistoryIcon, isActive: (p) => p.startsWith('/history') },
  {
    key: 'trends',
    label: 'Trends',
    to: '/trends',
    Icon: TrendsIcon,
    isActive: (p) => p.startsWith('/trends') || p.startsWith('/weight') || p.startsWith('/report'),
  },
  {
    key: 'settings',
    label: 'Settings',
    to: '/settings',
    Icon: SettingsIcon,
    isActive: (p) => p.startsWith('/settings'),
  },
]

export default function BottomTabBar() {
  const location = useLocation()
  const { openAddFoodSheet } = useUIState()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-700 dark:bg-surface-dark-card"
      aria-label="Primary"
      data-testid="bottom-tab-bar"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.key} tab={tab} active={tab.isActive(location.pathname)} />
        ))}

        <div className="relative flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openAddFoodSheet(activeMealWindow(new Date()) ?? 'breakfast')}
            aria-label="Scan or add food"
            data-testid="fab-scan"
            className="absolute -top-6 flex min-h-touch min-w-touch flex-col items-center justify-center rounded-full bg-brand-600 p-4 text-white shadow-card active:scale-95"
          >
            <ScanIcon />
          </button>
          <span className="pointer-events-none mt-8 text-caption text-slate-500 dark:text-slate-400">Scan</span>
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
      className={`flex min-h-touch min-w-touch flex-1 flex-col items-center justify-center gap-0.5 py-1.5 ${
        active ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <Icon active={active} />
      <span className="text-caption">{tab.label}</span>
    </Link>
  )
}
