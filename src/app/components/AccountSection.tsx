import { useState } from 'react'
import { signIn, signOut, useSession } from '../../lib/auth/authClient'
import { signOutLocally } from '../../lib/sync/guestMode'
import { useUIState } from '../shell/UIStateContext'

export default function AccountSection() {
  const { data: session, isPending } = useSession()
  const { notifyDataChanged } = useUIState()
  const [busy, setBusy] = useState(false)

  async function handleSignIn() {
    setBusy(true)
    await signIn.social({ provider: 'google', callbackURL: '/welcome' })
  }

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOut()
      await signOutLocally()
      notifyDataChanged()
    } finally {
      setBusy(false)
    }
  }

  if (isPending) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading account…</div>
  }

  if (session) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-900 dark:text-slate-100">
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
        <button
          type="button"
          data-testid="account-sign-out-button"
          onClick={handleSignOut}
          disabled={busy}
          className="min-h-touch self-start rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-300"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Not signed in - your data stays on this device.
      </p>
      <button
        type="button"
        data-testid="account-sign-in-button"
        onClick={handleSignIn}
        disabled={busy}
        className="min-h-touch self-start rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-brand-700 dark:border-slate-600 dark:text-brand-400"
      >
        Sign in to back up
      </button>
    </div>
  )
}
