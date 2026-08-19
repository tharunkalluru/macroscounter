import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession, signIn } from '../lib/auth/authClient'
import { chooseGuestMode } from '../lib/sync/guestMode'
import { resolveAfterSignIn } from '../lib/sync/resolveAfterSignIn'

/**
 * First-launch screen: shown once, before onboarding, when this device has
 * never made a sign-in-or-guest choice (see `hasMadeSignInChoice`). If a
 * Better Auth session already exists — e.g. IndexedDB was cleared but the
 * browser still carries the session cookie — this skips straight to the
 * pull/migrate resolution instead of showing the buttons again.
 */
export default function SignInScreen() {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (isPending || !session || resolving) return
    setResolving(true)
    resolveAfterSignIn().then((outcome) => {
      navigate(outcome === 'ready' ? '/' : '/onboarding', { replace: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session])

  async function handleGoogleSignIn() {
    await signIn.social({ provider: 'google', callbackURL: '/welcome' })
  }

  async function handleSkip() {
    await chooseGuestMode()
    navigate('/onboarding')
  }

  const showButtons = !isPending && !session && !resolving

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <h1 className="mb-1 text-3xl font-bold text-brand-700 dark:text-brand-400">MacroDesi</h1>
      <p className="mb-10 text-sm text-slate-500 dark:text-slate-400">
        Simple calorie & macro tracking, built for Indian food.
      </p>

      {showButtons ? (
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            data-testid="signin-google-button"
            onClick={handleGoogleSignIn}
            className="flex min-h-touch items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <img src="/icons/google-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
            Continue with Google
          </button>
          <button
            type="button"
            data-testid="signin-skip-button"
            onClick={handleSkip}
            className="min-h-touch rounded-lg px-4 py-2.5 text-sm text-slate-500 underline dark:text-slate-400"
          >
            Skip for now
          </button>
        </div>
      ) : (
        <div className="text-sm text-slate-500 dark:text-slate-400" role="status">
          {isPending ? 'Loading…' : 'Setting things up…'}
        </div>
      )}
    </div>
  )
}
