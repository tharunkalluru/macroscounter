import { createAuthClient } from 'better-auth/react'

/**
 * Same-origin by default (Better Auth's client falls back to
 * `window.location.origin` when `baseURL` is omitted) — the Vercel
 * deployment serves both the SPA and `/api/auth/*` from one origin, so no
 * env var is required for this to work in production. `VITE_APP_URL` is
 * only needed server-side (see api/_authServer.ts) for constructing OAuth
 * redirect URLs.
 */
export const authClient = createAuthClient()

export const { useSession, signIn, signOut, getSession } = authClient
