/** Shared shimmer block — was duplicated identically in DashboardSkeleton.tsx and ScanProductPage.tsx. */
export function Pulse({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
}

/** Mirrors WeightSection's loaded shape (log form + chart) so nothing shifts once data arrives. */
export function WeightSectionSkeleton() {
  return (
    <div aria-hidden="true" data-testid="weight-section-skeleton">
      <div className="flex items-end gap-3 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card">
        <Pulse className="h-[60px] w-28" />
        <Pulse className="h-[60px] w-24" />
        <Pulse className="h-11 w-16" />
      </div>
      <Pulse className="mt-6 h-56 w-full rounded-card" />
      <Pulse className="mt-6 h-24 w-full rounded-lg" />
    </div>
  )
}
