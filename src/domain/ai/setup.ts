import { z } from 'zod'

/** AI fills a draft only. Confirmed values still pass through the goal engine. */
export const SetupDraftSchema = z.object({
  name: z.string().trim().min(1).max(80).nullable(),
  age: z.number().int().min(18).max(100).nullable(),
  sex: z.enum(['male', 'female']).nullable(),
  heightCm: z.number().finite().min(100).max(250).nullable(),
  weightKg: z.number().finite().min(30).max(300).nullable(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).nullable(),
  goal: z.enum(['cut', 'maintain', 'gain']).nullable(),
  dietStyle: z.enum(['balanced', 'low_fat', 'low_carb', 'keto']).nullable(),
})

export const SetupResponseSchema = z.object({
  draft: SetupDraftSchema,
  notes: z.array(z.string().trim().min(1).max(200)).max(4),
})

export type SetupDraft = z.infer<typeof SetupDraftSchema>
export type SetupResponse = z.infer<typeof SetupResponseSchema>

/** Unsupported provider values never become onboarding defaults. */
export function normalizeSetupResponse(value: unknown): SetupResponse | null {
  if (!value || typeof value !== 'object' || !('draft' in value)) return null
  const draft = value.draft
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null
  const normalized = Object.fromEntries(
    Object.entries(SetupDraftSchema.shape).map(([key, schema]) => {
      const parsed = schema.safeParse((draft as Record<string, unknown>)[key])
      return [key, parsed.success ? parsed.data : null]
    })
  ) as SetupDraft
  // Notes are extraction notes, never advice. Ignore a malformed notes payload.
  const notes =
    'notes' in value && Array.isArray(value.notes)
      ? value.notes
          .filter((note): note is string => typeof note === 'string' && !!note.trim())
          .slice(0, 4)
          .map((note) => note.trim().slice(0, 200))
      : []
  return { draft: normalized, notes }
}
