import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession, signIn, signOut } from '../lib/auth/authClient'
import { chooseGuestMode } from '../lib/sync/guestMode'
import { resolveAfterSignIn } from '../lib/sync/resolveAfterSignIn'

export default function SignInScreen() {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const userId = session?.user.id

  useEffect(() => {
    if (isPending || !userId) return
    let cancelled = false
    setResolving(true)
    setError(null)
    resolveAfterSignIn().then((outcome) => {
      if (!cancelled) navigate(outcome === 'ready' ? '/' : '/onboarding', { replace: true })
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'We could not finish signing you in. Please try again.')
    }).finally(() => {
      if (!cancelled) setResolving(false)
    })
    return () => { cancelled = true }
  }, [isPending, userId, attempt, navigate])

  async function handleGoogleSignIn() {
    setResolving(true)
    setError(null)
    try {
      const result = await signIn.social({ provider: 'google', callbackURL: '/welcome' })
      if (result.error) throw new Error('Google sign-in could not start. Please try again.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not connect to Google. Please try again.')
    } finally { setResolving(false) }
  }

  async function handleSwitchAccount() {
    setResolving(true)
    try {
      // Detach only the remote session; pending local data stays linked to its owner.
      const result = await signOut()
      if (result.error) throw new Error('We could not switch accounts. Please try again.')
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.')
    } finally { setResolving(false) }
  }

  async function handleSkip() {
    setResolving(true)
    setError(null)
    try {
      await chooseGuestMode()
      navigate('/onboarding')
    } catch {
      setError('This browser could not save your diary. Check that browser storage is available, then try again.')
    } finally { setResolving(false) }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-3xl dark:bg-brand-900/30" aria-hidden="true">🥗</div>
      <h1 className="mb-2 text-3xl font-bold text-brand-700 dark:text-brand-400">Welcome to Bitewise</h1>
      <p className="mb-8 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Your everyday food diary. Log the food you love, build a routine, and see your progress.
      </p>
      {error ? (
        <div role="alert" className="mb-5 w-full rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/20 dark:text-danger-300">
          <p>{error}</p>
          {session ? <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" disabled={resolving} onClick={() => setAttempt((value) => value + 1)} className="min-h-touch rounded-lg px-4 font-semibold underline">Try again</button>
            <button type="button" disabled={resolving} onClick={handleSwitchAccount} className="min-h-touch rounded-lg px-4 underline">Use another account</button>
          </div> : null}
        </div>
      ) : null}
      {!isPending && !session ? (
        <div className="flex w-full flex-col gap-3">
          <button type="button" data-testid="signin-google-button" onClick={handleGoogleSignIn} disabled={resolving}
            className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <img src="/icons/google-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
            Continue with Google
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Back up your diary and use it across your devices.</p>
          <button type="button" data-testid="signin-skip-button" onClick={handleSkip} disabled={resolving}
            className="min-h-touch rounded-xl px-4 py-2.5 text-sm text-slate-600 underline disabled:opacity-50 dark:text-slate-400">Skip for now</button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Without an account, your diary is saved only in this browser.</p>
        </div>
      ) : !error ? (
        <div className="text-sm text-slate-500 dark:text-slate-400" role="status">{isPending ? 'Loading your account…' : 'Restoring your diary…'}</div>
      ) : null}
    </div>
  )
}
