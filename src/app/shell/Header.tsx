import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { groupEntriesByDate } from '../../domain/history/averages'
import { computeStreak, computeStreakStartDate, getStreakMilestone } from '../../domain/streaks/streak'
import { useSession } from '../../lib/auth/authClient'
import { addDaysISO, todayISO } from '../../lib/date'
import { vibrateSuccess } from '../../lib/haptics'
import {
  hasCelebratedStreakMilestone,
  markStreakMilestoneCelebrated,
} from '../../lib/logging/streakMilestoneCelebration'
import GoalCelebration from '../components/GoalCelebration'
import SyncStatusDot from '../components/SyncStatusDot'
import { FlameIcon } from './icons'
import { useUIState } from './UIStateContext'

// Wide enough to correctly measure streaks well past the highest milestone
// (100+ days) rather than silently capping at the window size.
const STREAK_WINDOW_DAYS = 180

export default function Header() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState(0)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null)
  const { dataVersion } = useUIState()
  const { data: session } = useSession()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const today = todayISO()
      const [p, entries] = await Promise.all([
        new ProfileRepo().get(),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -(STREAK_WINDOW_DAYS - 1)), today),
      ])
      if (cancelled) return
      setProfile(p ?? null)

      const loggedDates = groupEntriesByDate(entries).map((d) => d.date)
      const currentStreak = computeStreak(loggedDates, today)
      setStreak(currentStreak)

      const milestone = getStreakMilestone(currentStreak)
      if (milestone) {
        const startDate = computeStreakStartDate(loggedDates, today, currentStreak)
        if (startDate && !hasCelebratedStreakMilestone(startDate, milestone)) {
          markStreakMilestoneCelebrated(startDate, milestone)
          vibrateSuccess()
          setMilestoneMessage(`${milestone}-day streak - you're on fire.`)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dataVersion])

  const initial = profile?.name?.trim()?.[0]?.toUpperCase() ?? '?'
  const avatarUrl = session?.user?.image ?? null
  const showAvatarImage = avatarUrl && !avatarFailed

  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-4 pt-6 lg:px-8">
      <div>
        <p className="text-title text-brand-700 dark:text-brand-400 lg:hidden">Bitewise</p>
        <p className="hidden text-sm font-medium text-slate-600 dark:text-slate-300 lg:block">{profile?.name ? `Hello, ${profile.name}` : 'Your daily nutrition'}</p>
        <div className="mt-1"><SyncStatusDot testId="header-sync-status" /></div>
        {streak > 0 && (
          <Link
            to="/trends"
            data-testid="streak-chip"
            className="mt-2 inline-flex min-h-touch items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-400"
          >
            <FlameIcon className="text-brand-700 dark:text-brand-400" />
            <span>
              {streak} day{streak === 1 ? '' : 's'}
            </span>
          </Link>
        )}
      </div>

      <Link
        to="/settings"
        aria-label="Settings"
        data-testid="avatar-link"
        className="flex h-11 w-11 min-h-touch min-w-touch shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-base font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-400"
      >
        {showAvatarImage ? (
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          initial
        )}
      </Link>

      <GoalCelebration
        show={milestoneMessage !== null}
        onDismiss={() => setMilestoneMessage(null)}
        message={milestoneMessage ?? ''}
        icon={FlameIcon}
        positionClassName="bottom-40"
      />
    </header>
  )
}
