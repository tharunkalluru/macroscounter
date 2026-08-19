import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Profile } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { groupEntriesByDate } from '../../domain/history/averages'
import { computeStreak } from '../../domain/streaks/streak'
import { addDaysISO, todayISO } from '../../lib/date'
import { useUIState } from './UIStateContext'

export default function Header() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [streak, setStreak] = useState(0)
  const { dataVersion } = useUIState()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const today = todayISO()
      const [p, entries] = await Promise.all([
        new ProfileRepo().get(),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -29), today),
      ])
      if (cancelled) return
      setProfile(p ?? null)
      setStreak(computeStreak(groupEntriesByDate(entries).map((d) => d.date), today))
    })()
    return () => {
      cancelled = true
    }
  }, [dataVersion])

  const initial = profile?.name?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="mx-auto flex max-w-md items-center justify-between px-6 pb-2 pt-6">
      <div>
        <p className="text-title text-brand-700">MacroDesi</p>
        {streak > 0 && (
          <Link
            to="/trends"
            data-testid="streak-chip"
            className="mt-1 inline-flex min-h-touch items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700"
          >
            <span aria-hidden="true">🔥</span>
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
        className="flex min-h-touch min-w-touch items-center justify-center rounded-full bg-brand-100 text-title text-brand-700"
      >
        {initial}
      </Link>
    </header>
  )
}
