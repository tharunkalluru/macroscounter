import { useSyncStatus } from '../hooks/useSyncStatus'

const STATUS_COPY: Record<string, { label: string; dotClass: string }> = {
  'signed-out': { label: 'Not signed in — local only', dotClass: 'bg-slate-400 dark:bg-slate-500' },
  synced: { label: 'Synced', dotClass: 'bg-brand-600' },
  syncing: { label: 'Syncing…', dotClass: 'bg-warn-500 motion-safe:animate-pulse' },
  offline: { label: 'Offline — will sync when back online', dotClass: 'bg-slate-400 dark:bg-slate-500' },
  error: { label: "Couldn't sync — will retry", dotClass: 'bg-danger-600' },
}

export default function SyncStatusDot() {
  const status = useSyncStatus()
  const copy = STATUS_COPY[status] ?? STATUS_COPY['signed-out']

  return (
    <div className="flex items-center gap-2 text-caption text-slate-500 dark:text-slate-400" data-testid="sync-status">
      <span className={`h-2 w-2 rounded-full ${copy.dotClass}`} aria-hidden="true" />
      <span>{copy.label}</span>
    </div>
  )
}
