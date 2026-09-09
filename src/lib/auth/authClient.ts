import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

/**
 * Same-origin by default (Better Auth's client falls back to
 * `window.location.origin` when `baseURL` is omitted) — the Vercel
 * deployment serves both the SPA and `/api/auth/*` from one origin, so no
 * env var is required for this to work in production. `VITE_APP_URL` is
 * only needed server-side (see api/_authServer.ts) for constructing OAuth
 * redirect URLs.
 *
 * `emailAndPassword`'s own methods (`signIn.email`, `signUp.email`,
 * `requestPasswordReset`, `resetPassword`) need no client plugin — they're
 * built into the base client whenever the server config enables them.
 * `emailOTPClient()` is what adds `emailOtp.sendVerificationOtp` and
 * `signIn.emailOtp`, matching the server's `emailOTP` plugin.
 */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] })

export const { useSession, signIn, signUp, signOut, getSession, requestPasswordReset, resetPassword, emailOtp } =
  authClient
