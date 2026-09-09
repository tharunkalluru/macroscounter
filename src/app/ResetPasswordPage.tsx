import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../lib/auth/authClient'
import { TEXT_INPUT_CLASS } from './components/formStyles'

/**
 * Reached externally from the link in the reset-password email
 * (`sendResetPasswordEmail`, api/_email.ts) — Better Auth appends the token
 * as a `token` query param to whatever `redirectTo` was passed at request
 * time (see SignInScreen's `handleRequestReset`).
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setSubmitting(true)
    try {
      const result = await resetPassword({ newPassword: password, token })
      if (result.error) throw new Error(result.error.message ?? 'This reset link is invalid or has expired.')
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This reset link is invalid or has expired.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-brand-700 dark:text-brand-400">Reset your password</h1>

      {!token ? (
        <>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            This link is missing its reset code. Request a new one from the sign-in screen.
          </p>
          <Link
            to="/welcome"
            className="min-h-touch inline-flex w-full items-center justify-center rounded-card bg-brand-700 px-4 font-medium text-white"
          >
            Back to sign in
          </Link>
        </>
      ) : done ? (
        <>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Your password has been reset. Sign in with your new password.
          </p>
          <Link
            to="/welcome"
            data-testid="reset-password-done-link"
            className="min-h-touch inline-flex w-full items-center justify-center rounded-card bg-brand-700 px-4 font-medium text-white"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Choose a new password for your account.</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="reset-password-new"
              className={TEXT_INPUT_CLASS}
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="reset-password-confirm"
              className={TEXT_INPUT_CLASS}
              minLength={8}
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger-700 dark:text-danger-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            data-testid="reset-password-submit"
            className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </div>
  )
}
