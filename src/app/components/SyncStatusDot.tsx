import { useSyncStatus } from '../hooks/useSyncStatus'
import { getSyncError, runSync } from '../../lib/sync/syncEngine'

const STATUS_COPY = {
  'signed-out': { label: 'Saved on this device', dotClass: 'bg-slate-400 dark:bg-slate-500' },
  synced: { label: 'Backed up', dotClass: 'bg-brand-600' },
  syncing: { label: 'Backing up…', dotClass: 'bg-warn-500 motion-safe:animate-pulse' },
  offline: { label: 'Offline · saved on this device', dotClass: 'bg-slate-400 dark:bg-slate-500' },
  error: { label: 'Backup needs attention', dotClass: 'bg-danger-600' },
}

export default function SyncStatusDot({ testId = 'sync-status' }: { testId?: string }) {
  const status = useSyncStatus()
  const copy = STATUS_COPY[status]
  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-slate-500 dark:text-slate-400" data-testid={testId} role="status" title={getSyncError() ?? copy.label}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${copy.dotClass}`} aria-hidden="true" />
      <span>{copy.label}</span>
      {status === 'error' ? <button type="button" onClick={() => { void runSync() }} className="min-h-touch rounded-lg px-2 font-medium text-brand-700 underline dark:text-brand-400">Retry backup</button> : null}
    </div>
  )
}
