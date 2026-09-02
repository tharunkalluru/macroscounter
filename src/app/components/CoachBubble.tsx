import type { ReactNode } from 'react'
import { SparkleIcon } from '../shell/icons'

/**
 * The "Your coach" chat-persona pattern the design uses for the expenditure
 * reveal (onboarding) and the weekly check-in wizard (Phase F.6) — a
 * sparkle avatar plus asymmetric message bubbles, with a quick-reply pill
 * variant for the user's side of the thread.
 */
export function CoachAvatar() {
  return (
    <span
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-brand-600 ring-1 ring-inset ring-brand-600 dark:text-brand-400 dark:ring-brand-400"
      aria-hidden="true"
    >
      <SparkleIcon />
    </span>
  )
}

export function CoachMessage({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <CoachAvatar />
      <div
        data-testid={testId}
        className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 dark:bg-surface-dark-card dark:text-slate-100"
      >
        {children}
      </div>
    </div>
  )
}

export function CoachQuickReply({
  children,
  onClick,
  testId,
}: {
  children: ReactNode
  onClick: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="min-h-touch self-end rounded-2xl rounded-br-md border border-brand-600 px-3.5 py-2 text-sm font-medium text-brand-700 transition-transform active:scale-[0.97] dark:border-brand-400 dark:text-brand-400"
    >
      {children}
    </button>
  )
}
