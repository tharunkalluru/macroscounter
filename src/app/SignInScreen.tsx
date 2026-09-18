import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authClient, useSession, signIn, signUp, signOut, requestPasswordReset } from '../lib/auth/authClient'
import { chooseGuestMode } from '../lib/sync/guestMode'
import { resolveAfterSignIn } from '../lib/sync/resolveAfterSignIn'
import SegmentedControl from './components/SegmentedControl'
import { TEXT_INPUT_CLASS } from './components/formStyles'

type Method = 'password' | 'code'
type PasswordScreen = 'signin' | 'signup' | 'forgot'

function errorMessage(error: { message?: string } | null | undefined, fallback: string): string {
  return error?.message || fallback
}

export default function SignInScreen() {
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const userId = session?.user.id

  const [method, setMethod] = useState<Method>('password')
  const [passwordScreen, setPasswordScreen] = useState<PasswordScreen>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

  function resetFormState() {
    setError(null)
    setInfo(null)
  }

  function switchMethod(next: Method) {
    setMethod(next)
    setPasswordScreen('signin')
    setOtpSent(false)
    setOtp('')
    setPassword('')
    resetFormState()
  }

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

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    resetFormState()
    setSubmitting(true)
    try {
      const result = await signIn.email({ email, password })
      if (result.error) throw new Error(errorMessage(result.error, 'Incorrect email or password.'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Incorrect email or password.')
    } finally { setSubmitting(false) }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    resetFormState()
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setSubmitting(true)
    try {
      const result = await signUp.email({ email, password, name: name.trim() || email })
      if (result.error) throw new Error(errorMessage(result.error, 'Could not create an account with that email.'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create an account with that email.')
    } finally { setSubmitting(false) }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    resetFormState()
    setSubmitting(true)
    try {
      await requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` })
      // Deliberately the same message whether or not this email has an
      // account -- not revealing account existence via the response.
      setInfo('If an account exists for that email, a reset link is on its way.')
    } catch {
      setInfo('If an account exists for that email, a reset link is on its way.')
    } finally { setSubmitting(false) }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    resetFormState()
    setSubmitting(true)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
      if (result.error) throw new Error(errorMessage(result.error, 'Could not send a code. Please try again.'))
      setOtpSent(true)
      setInfo(`We sent a 6-digit code to ${email}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a code. Please try again.')
    } finally { setSubmitting(false) }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    resetFormState()
    setSubmitting(true)
    try {
      const result = await signIn.emailOtp({ email, otp })
      if (result.error) throw new Error(errorMessage(result.error, 'That code is incorrect or has expired.'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code is incorrect or has expired.')
    } finally { setSubmitting(false) }
  }

  const showEmailForms = !isPending && !session && !resolving

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 py-10 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-3xl dark:bg-brand-900/30" aria-hidden="true">🥗</div>
      <h1 className="mb-2 text-3xl font-bold text-brand-700 dark:text-brand-400">Welcome to Bitewise</h1>
      <p className="mb-8 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Your everyday food diary.
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
      {info ? (
        <div role="status" className="mb-5 w-full rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700 dark:border-brand-800 dark:bg-slate-800 dark:text-brand-400">
          {info}
        </div>
      ) : null}

      {showEmailForms ? (
        <div className="flex w-full flex-col gap-3">
          <button type="button" data-testid="signin-google-button" onClick={handleGoogleSignIn} disabled={resolving}
            className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
            <img src="/icons/google-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
            Continue with Google
          </button>

          <div className="my-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            or
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <SegmentedControl
            label="Sign in with"
            options={[{ value: 'password', label: 'Password' }, { value: 'code', label: 'Email code' }]}
            value={method}
            onChange={switchMethod}
            testIdPrefix="signin-method"
          />

          {method === 'password' && passwordScreen === 'signin' && (
            <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-3 text-left">
              <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="signin-email-input" className={TEXT_INPUT_CLASS} />
              <input type="password" required autoComplete="current-password" placeholder="Password" aria-label="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} data-testid="signin-password-input" className={TEXT_INPUT_CLASS} />
              <button type="submit" disabled={submitting} data-testid="signin-password-submit"
                className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50">
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => { setPasswordScreen('forgot'); resetFormState() }} className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400">Forgot password?</button>
                <button type="button" data-testid="signin-show-signup" onClick={() => { setPasswordScreen('signup'); resetFormState() }} className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400">Create account</button>
              </div>
            </form>
          )}

          {method === 'password' && passwordScreen === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-3 text-left">
              <input type="text" autoComplete="name" placeholder="Your name" aria-label="Your name" value={name}
                onChange={(e) => setName(e.target.value)} data-testid="signup-name-input" className={TEXT_INPUT_CLASS} />
              <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="signup-email-input" className={TEXT_INPUT_CLASS} />
              <input type="password" required autoComplete="new-password" placeholder="Password (min. 8 characters)" aria-label="Password (min. 8 characters)" value={password}
                onChange={(e) => setPassword(e.target.value)} minLength={8} data-testid="signup-password-input" className={TEXT_INPUT_CLASS} />
              <button type="submit" disabled={submitting} data-testid="signup-submit"
                className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50">
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
              <button type="button" data-testid="signup-show-signin" onClick={() => { setPasswordScreen('signin'); resetFormState() }} className="min-h-touch inline-flex items-center justify-center self-center text-sm text-brand-700 underline dark:text-brand-400">
                Already have an account? Sign in
              </button>
            </form>
          )}

          {method === 'password' && passwordScreen === 'forgot' && (
            <form onSubmit={handleRequestReset} className="flex flex-col gap-3 text-left">
              <p className="text-sm text-slate-500 dark:text-slate-400">Enter your email and we'll send a link to reset your password.</p>
              <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="forgot-password-email-input" className={TEXT_INPUT_CLASS} />
              <button type="submit" disabled={submitting} data-testid="forgot-password-submit"
                className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => { setPasswordScreen('signin'); resetFormState() }} className="min-h-touch inline-flex items-center justify-center self-center text-sm text-brand-700 underline dark:text-brand-400">
                Back to sign in
              </button>
            </form>
          )}

          {method === 'code' && !otpSent && (
            <form onSubmit={handleSendCode} className="flex flex-col gap-3 text-left">
              <input type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="code-email-input" className={TEXT_INPUT_CLASS} />
              <button type="submit" disabled={submitting} data-testid="code-send-submit"
                className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send code'}
              </button>
            </form>
          )}

          {method === 'code' && otpSent && (
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-3 text-left">
              <input type="text" inputMode="numeric" autoComplete="one-time-code" required placeholder="6-digit code" aria-label="6-digit code" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} data-testid="code-otp-input" className={TEXT_INPUT_CLASS} />
              <button type="submit" disabled={submitting || otp.length < 6} data-testid="code-verify-submit"
                className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50">
                {submitting ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={(e) => handleSendCode(e as unknown as React.FormEvent)} disabled={submitting} className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400 disabled:opacity-50">Resend code</button>
                <button type="button" onClick={() => { setOtpSent(false); setOtp(''); resetFormState() }} className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400">Use a different email</button>
              </div>
            </form>
          )}

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sign in to sync across devices.</p>
          <button type="button" data-testid="signin-skip-button" onClick={handleSkip} disabled={resolving}
            className="min-h-touch rounded-xl px-4 py-2.5 text-sm text-slate-600 underline disabled:opacity-50 dark:text-slate-400">Continue as guest</button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Guest data is saved only in this browser.</p>
        </div>
      ) : !error ? (
        <div className="text-sm text-slate-500 dark:text-slate-400" role="status">{isPending ? 'Loading your account…' : 'Restoring your diary…'}</div>
      ) : null}
    </main>
  )
}
