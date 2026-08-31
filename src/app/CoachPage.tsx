import PageHeader from './components/PageHeader'
import { CoachIcon } from './shell/icons'

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Coach" backTo="/" />
      <div
        className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-surface-dark-card"
        data-testid="coach-placeholder"
      >
        <CoachIcon active className="mt-0.5 shrink-0 text-brand-500" />
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Weekly check-ins are coming here.
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Coach will compare your logged intake against your actual weight trend each week and
            suggest a target adjustment when they drift apart — the same suggestion you may
            already see on Today, in a dedicated home.
          </p>
        </div>
      </div>
    </div>
  )
}
