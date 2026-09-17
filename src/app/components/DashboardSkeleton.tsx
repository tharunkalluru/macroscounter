import { Pulse } from './Skeleton'

/** Mirrors the dashboard hierarchy while the local diary is loading. */
export default function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-4 lg:px-8" data-testid="dashboard-skeleton" aria-hidden="true">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div><Pulse className="h-8 w-60" /><Pulse className="mt-2 h-4 w-48" /></div>
        <Pulse className="h-14 w-64" />
      </div>
      <Pulse className="mb-5 h-28 w-full rounded-2xl sm:h-16" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
          <Pulse className="h-5 w-32" />
          <div className="my-4 flex items-center justify-center gap-5">
            <Pulse className="h-40 w-40 rounded-full" />
            <Pulse className="h-32 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Pulse key={i} className="h-24 w-full rounded-xl" />)}</div>
        </div>
        <div className="space-y-5">
          <Pulse className="h-72 w-full rounded-card" />
          <Pulse className="h-52 w-full rounded-card" />
        </div>
      </div>
    </div>
  )
}
