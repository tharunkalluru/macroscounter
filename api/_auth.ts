import type { VercelRequest } from '@vercel/node'

export const SESSION_COOKIE = 'macrodesi_session'

/**
 * Reads the current user id from the session cookie. This is a minimal
 * stand-in — 10.2 replaces the cookie's contents and verification with a
 * real Better Auth session (signed, httpOnly, secure, SameSite=Lax), but
 * every `/api` route is written against this same `requireUserId` shape
 * from the start, so swapping the verification logic in 10.2 doesn't touch
 * the sync routes at all.
 */
export function getUserId(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
  if (!match) return null
  const value = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1))
  return value || null
}
