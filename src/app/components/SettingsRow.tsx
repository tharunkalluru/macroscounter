import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '../shell/icons'

interface Props {
  to: string
  icon: ComponentType<{ className?: string }>
  label: string
  valueHint?: string
  testId?: string
}

/** Chevron nav row for the Settings hub — icon, label, a monospace value-hint of the current state, and a chevron. */
export default function SettingsRow({ to, icon: Icon, label, valueHint, testId }: Props) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="flex min-h-touch items-center gap-3 py-2 transition-transform active:scale-[0.98]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 font-medium text-slate-900 dark:text-slate-100">{label}</span>
      {valueHint && (
        <span className="flex-none font-mono text-caption uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {valueHint}
        </span>
      )}
      <ChevronRightIcon className="flex-none text-slate-400 dark:text-slate-500" />
    </Link>
  )
}
