function Pulse({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
}

/** Mirrors the shape/height of the loaded Today dashboard so nothing shifts once data arrives. */
export default function DashboardSkeleton() {
  return (
    <div className="pb-4" data-testid="dashboard-skeleton" aria-hidden="true">
      <div className="mx-auto flex max-w-md items-center justify-center gap-1 px-6">
        <Pulse className="h-9 w-36" />
      </div>

      <div className="mx-auto mt-4 max-w-md px-6">
        <div className="flex flex-col items-center rounded-card bg-white p-6 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
          <Pulse className="h-[180px] w-[180px] rounded-full" />
          <Pulse className="mt-4 h-4 w-40" />
          <div className="mt-6 grid w-full grid-cols-1 gap-3">
            <Pulse className="h-8 w-full" />
            <Pulse className="h-8 w-full" />
            <Pulse className="h-8 w-full" />
          </div>
        </div>

        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mt-6">
            <Pulse className="h-5 w-24" />
            <Pulse className="mt-2 h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
