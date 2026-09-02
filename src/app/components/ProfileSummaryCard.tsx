import { useSession } from '../../lib/auth/authClient'

interface Props {
  name: string
}

function formatSince(createdAt: unknown): string | null {
  const date = new Date(createdAt as string | number | Date)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Profile summary at the top of the Settings hub — presentational only, the actual fields are still edited inline below it. */
export default function ProfileSummaryCard({ name }: Props) {
  const { data: session } = useSession()
  const initial = name.trim()[0]?.toUpperCase() ?? '?'
  const since = session ? formatSince(session.user.createdAt) : null

  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card"
      data-testid="profile-summary-card"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-title text-brand-700 dark:bg-slate-800 dark:text-brand-400">
        {initial}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-slate-900 dark:text-slate-100">{name || 'You'}</span>
        {session && (
          <span className="block truncate text-caption text-slate-500 dark:text-slate-400">
            {session.user.email}
            {since && ` · Since ${since}`}
          </span>
        )}
      </span>
    </div>
  )
}
