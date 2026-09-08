import { useState } from 'react'
import { signIn, signOut, useSession } from '../../lib/auth/authClient'
import { db } from '../../data/db'
import { signOutLocally } from '../../lib/sync/guestMode'
import { runSync, withSyncPaused } from '../../lib/sync/syncEngine'

export default function AccountSection() {
  const { data: session, isPending } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      const result = await signIn.social({ provider: 'google', callbackURL: '/welcome' })
      if (result.error) throw new Error('Sign-in could not start. Please try again.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not connect. Please try again.')
    } finally { setBusy(false) }
  }

  async function handleSignOut() {
    setBusy(true)
    setError(null)
    try {
      const meta = await db.syncMeta.toCollection().first()
      if (!meta?.userId || meta.userId !== session?.user.id) {
        throw new Error('Finish setting up your account before signing out so your diary can be backed up.')
      }
      await runSync()
      await withSyncPaused(db, async () => {
        if (await db.syncOutbox.count() > 0) {
          throw new Error('Your latest changes are still waiting to sync. Connect to the internet and retry before signing out. Your diary is safe on this device.')
        }
        const result = await signOut()
        if (result.error) throw new Error('We could not sign you out. Please try again.')
        await signOutLocally()
      })
      // Clear in-memory private views as well as the database cache.
      window.location.assign('/welcome')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-out could not finish. Your diary has been kept on this device.')
    } finally { setBusy(false) }
  }

  if (isPending) return <div className="text-sm text-slate-500 dark:text-slate-400">Loading account…</div>

  return (
    <div className="flex flex-col gap-2">
      {session ? (
        <>
          <p className="text-sm text-slate-900 dark:text-slate-100">Signed in as <span className="font-medium">{session.user.email}</span></p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Signing out backs up your changes and removes your private diary from this browser.</p>
          <button type="button" data-testid="account-sign-out-button" onClick={handleSignOut} disabled={busy}
            className="min-h-touch self-start rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300">{busy ? 'Saving your diary…' : 'Sign out'}</button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your diary is saved only in this browser. Sign in to back it up and use another device.</p>
          <button type="button" data-testid="account-sign-in-button" onClick={handleSignIn} disabled={busy}
            className="min-h-touch self-start rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:text-brand-400">{busy ? 'Connecting…' : 'Sign in to back up'}</button>
        </>
      )}
      {error ? <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-900/20 dark:text-danger-300">{error}</p> : null}
    </div>
  )
}
