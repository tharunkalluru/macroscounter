import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '../shell/icons'

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
    <div className="mb-6 flex items-center gap-3">
      <Link
        to={backTo}
        aria-label={backLabel}
        className="flex min-h-touch min-w-touch items-center justify-center pressable rounded-xl bg-white shadow-card dark:bg-surface-dark-card dark:shadow-card-dark text-slate-600 dark:text-slate-300"
      >
        <ArrowLeftIcon />
      </Link>
      <h1 className="text-title tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
    </div>
  )
}
