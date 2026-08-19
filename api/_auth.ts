import type { VercelRequest } from '@vercel/node'
import { fromNodeHeaders } from 'better-auth/node'
import { getAuth } from './_authServer'

/**
 * Resolves the current signed-in user id from Better Auth's session cookie
 * (httpOnly, secure in production, SameSite=Lax — see api/_authServer.ts).
 * Returns null for guests and expired/invalid sessions; callers 401 in that
 * case. `getSession` never throws for a missing/bad cookie, only for actual
 * infrastructure failures, so no try/catch is needed here.
 */
export async function getUserId(req: VercelRequest): Promise<string | null> {
  const session = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) })
  return session?.user.id ?? null
}
