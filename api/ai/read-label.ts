import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getUserId } from '../_auth.js'
import { allowAiRequest } from '../_aiBudget.js'

const input = z.object({ data: z.string().min(1).max(4_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/), mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']) })
const nutrient = z.number().finite().min(0).max(100000).optional()
export const labelResponse = z.object({ name: z.string().max(500).optional(), kcal: nutrient, p: nutrient, c: nutrient, f: nutrient, fiber: nutrient })

/** Credentials for the optional label provider never enter the browser bundle. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader?.('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const userId = await getUserId(req)
    if (!userId) { res.status(401).json({ error: 'Sign in to read a nutrition label.' }); return }
    const endpoint = process.env.LABEL_READER_ENDPOINT
    const key = process.env.LABEL_READER_API_KEY
    if (!endpoint || !key || new URL(endpoint).protocol !== 'https:') {
      res.status(503).json({ error: 'Label reading is not configured. You can enter the label values below.' }); return
    }
    const parsed = input.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: 'Choose a smaller JPEG, PNG, or WebP photo.' }); return }
    if (!(await allowAiRequest(userId, res))) return
    const form = new FormData()
    form.append('image', new Blob([Buffer.from(parsed.data.data, 'base64')], { type: parsed.data.mediaType }), 'label')
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('Provider unavailable')
    const result = labelResponse.safeParse(await response.json())
    if (!result.success) throw new Error('Invalid provider response')
    res.status(200).json(result.data)
  } catch {
    res.status(502).json({ error: 'The label could not be read. Try another photo or enter the values below.' })
  }
}
