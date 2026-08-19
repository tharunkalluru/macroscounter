import { useEffect, useState } from 'react'
import { getSyncStatus, onSyncStatusChange, type SyncStatus } from '../../lib/sync/syncEngine'

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus())

  useEffect(() => onSyncStatusChange(setStatus), [])

  return status
}
