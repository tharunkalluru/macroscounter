import { Link } from 'react-router-dom'
import { ChevronLeftIcon } from '../shell/icons'

interface Props {
  title: string
  backTo: string
  backLabel?: string
}

/**
 * Shared secondary-screen header — icon back button + title, matching
 * Dashboard/Settings' chrome level. Replaces the "← Back" text-link + bare
 * `<h1>` pattern every other screen used before Phase 11.
 */
export default function PageHeader({ title, backTo, backLabel = 'Back' }: Props) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Link
        to={backTo}
        aria-label={backLabel}
        className="flex min-h-touch min-w-touch items-center justify-center rounded-full -ml-2 text-slate-600 dark:text-slate-300"
      >
        <ChevronLeftIcon />
      </Link>
      <h1 className="text-title text-brand-700 dark:text-brand-400">{title}</h1>
    </div>
  )
}
