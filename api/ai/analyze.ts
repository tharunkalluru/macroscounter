import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { getUserId } from '../_auth.js'

const MAX_DESCRIPTION_CHARS = 1000
// ~4MB decoded, comfortably under Vercel's ~4.5MB function body limit.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const FoodItemSchema = z.object({
  name: z.string(),
  gramsEstimate: z.number().nullable(),
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  confidence: z.enum(['high', 'low']),
})

const AnalysisSchema = z.object({ items: z.array(FoodItemSchema).max(10) })

export type FoodItemResult = z.infer<typeof FoodItemSchema>

export interface AnalyzeRequestBody {
  description?: string
  image?: { data: string; mediaType: string }
}

const SYSTEM_PROMPT = `You are a nutrition estimator for a calorie/macro tracking app whose users log both Indian home-style food and branded/international products. Given a text description and/or a photo of a meal, identify every distinct food item described or visible.

For each item:
- Use a stated quantity when the user gives one (e.g. "100g grilled chicken breast"); otherwise estimate a reasonable portion size from visual cues (plate size, common serving sizes) or from typical serving conventions if there's no photo.
- Compute kcal, protein (g), carbs (g), and fat (g) for that specific quantity, using standard nutrition knowledge for that food and preparation method.
- Set confidence to "high" when the user stated an exact quantity, "low" when the portion is your own visual/typical-serving estimate.
- Only include items actually described or visible — never invent items that weren't mentioned or shown.
- Return at most 10 items.`

/** Pure, unit-testable: turns the request body into Claude message content — image block first (per the vision API's documented ordering), then the text. */
export function buildUserContent(body: AnalyzeRequestBody): Anthropic.Messages.ContentBlockParam[] {
  const content: Anthropic.Messages.ContentBlockParam[] = []
  if (body.image) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: body.image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data: body.image.data,
      },
    })
  }
  content.push({
    type: 'text',
    text: body.description?.trim() || 'Analyse the food shown in this photo.',
  })
  return content
}

/** Pure validation, separated from the handler so it's unit-testable without a mock req/res. */
export function validateRequestBody(
  body: unknown
): { ok: true; value: AnalyzeRequestBody } | { ok: false; error: string } {
  const b = body as Partial<AnalyzeRequestBody> | null | undefined
  const description = typeof b?.description === 'string' ? b.description.trim() : undefined
  const image = b?.image

  if (!description && !image) {
    return { ok: false, error: 'Provide a description or a photo.' }
  }
  if (description && description.length > MAX_DESCRIPTION_CHARS) {
    return { ok: false, error: 'Description is too long.' }
  }
  if (image) {
    if (typeof image.data !== 'string' || typeof image.mediaType !== 'string') {
      return { ok: false, error: 'Invalid photo payload.' }
    }
    // base64 length -> decoded byte estimate (4 chars ~= 3 bytes).
    if (image.data.length * 0.75 > MAX_IMAGE_BYTES) {
      return { ok: false, error: 'Photo is too large.' }
    }
  }
  return { ok: true, value: { description, image } }
}

export async function analyzeMeal(client: Anthropic, body: AnalyzeRequestBody): Promise<FoodItemResult[] | null> {
  const response = await client.messages.parse({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserContent(body) }],
    output_config: { format: zodOutputFormat(AnalysisSchema) },
  })
  return response.parsed_output?.items ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Sign in to use AI logging.', code: 'not_signed_in' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'AI logging is not configured yet.', code: 'missing_key' })
    return
  }

  const validated = validateRequestBody(req.body)
  if (!validated.ok) {
    res.status(400).json({ error: validated.error, code: 'invalid_input' })
    return
  }

  try {
    const client = new Anthropic({ apiKey })
    const items = await analyzeMeal(client, validated.value)
    if (!items) {
      res.status(502).json({ error: "Couldn't analyse that - try again.", code: 'upstream_error' })
      return
    }
    res.status(200).json({ items })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Too many requests - try again shortly.', code: 'rate_limited' })
      return
    }
    if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: "Couldn't analyse that - try again.", code: 'upstream_error' })
      return
    }
    res.status(500).json({ error: "Couldn't analyse that - try again.", code: 'upstream_error' })
  }
}
