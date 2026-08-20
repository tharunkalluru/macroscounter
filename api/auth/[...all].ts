import type { VercelRequest, VercelResponse } from '@vercel/node'
import { toNodeHandler } from 'better-auth/node'
import { getAuth } from '../_authServer.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return toNodeHandler(getAuth())(req, res)
}
