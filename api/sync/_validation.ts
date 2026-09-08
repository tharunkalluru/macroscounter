import { z } from 'zod'

export const MAX_MUTATIONS = 100
export const MAX_PUSH_BYTES = 1_000_000
const text = z.string().max(500)
const positive = z.number().finite().positive().max(1_000_000)
const amount = z.number().finite().min(0).max(1_000_000)
const optionalAmount = amount.nullish()
const uuid = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'Invalid calendar date')
const macros = z.object({ kcal: amount, p: amount, c: amount, f: amount, fiber: optionalAmount })
const snapshot = macros.extend({ name: text })
const logFields = {
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snacks']),
  foodId: text.nullish(), recipeId: uuid.nullish(), customSnapshot: snapshot.nullish(),
  barcode: text.nullish(), name: text.min(1), portionSummary: text,
  portionLabel: text.nullish(), qty: positive, unit: z.enum(['grams', 'portion']),
  grams: amount, kcal: amount, p: amount, c: amount, f: amount, fiber: optionalAmount,
}
const templateSnapshot = z.object({ ...logFields, meal: logFields.meal.optional(), recipeId: z.union([uuid, z.number().int().positive()]).nullish() })

const payloads = {
  profiles: z.object({
    name: text, sex: z.enum(['male', 'female']), age: z.number().int().min(0).max(130),
    heightCm: z.number().positive().max(300), weightKg: z.number().positive().max(1000),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    goal: z.enum(['cut', 'maintain', 'gain']),
    heightUnit: z.enum(['cm', 'ft_in']).nullish(), weightUnit: z.enum(['kg', 'lb']).nullish(),
    goalWeightKg: positive.nullish(), dateOfBirth: date.nullish(), bodyFatPercent: z.number().min(0).max(100).nullish(),
    weightHistoryClass: text.nullish(), weighedMoreBefore: text.nullish(), recentWeightTrend: text.nullish(),
    dietStyle: text.nullish(), proteinPriority: text.nullish(), calorieFloorChoice: text.nullish(),
    goalRateLbPerWeek: z.number().min(0).max(10).nullish(),
  }),
  targets: z.object({ effectiveDate: date, kcal: amount, proteinG: amount, carbsG: amount, fatG: amount, fiberG: optionalAmount, source: z.enum(['computed', 'manual', 'adaptive']) }),
  logEntries: z.object({ ...logFields, date, loggedAt: z.iso.datetime({ offset: true }).nullish().transform((value) => value ? new Date(value) : null) }),
  weighIns: z.object({ date, weightKg: positive }),
  recipes: z.object({ name: text.min(1), ingredients: z.array(z.object({ foodId: text.min(1), grams: positive })).max(200), servings: positive, computedPer100g: macros }),
  mealTemplates: z.object({ name: text.min(1), entries: z.array(z.object({ foodId: text.optional(), qty: positive, unit: z.enum(['grams', 'portion']), snapshot: templateSnapshot.optional() }).refine((entry) => !!entry.foodId || !!entry.snapshot, 'A food or saved snapshot is required')).max(200) }),
  scannedProducts: z.object({
    barcode: z.string().min(1).max(100), name: text.min(1), brand: text.nullish(),
    imageUrl: z.string().url().max(2000).nullish(),
    per100g: macros.extend({ sugar: optionalAmount, saturatedFat: optionalAmount, sodium: optionalAmount }),
    perServing: macros.extend({ sugar: optionalAmount, saturatedFat: optionalAmount, sodium: optionalAmount }).nullish(),
    servingSize: positive.nullish(), servingSizeText: text.nullish(), quantity: positive.nullish(),
    source: text, firstScanned: z.string().max(100),
  }),
} as const

export type TableKey = keyof typeof payloads
export interface ValidMutation {
  table: TableKey
  clientId: string
  operation: 'upsert' | 'delete'
  payload: Record<string, unknown> | null
  updatedAt: number
}
const envelope = z.object({
  table: z.enum(['profiles', 'targets', 'logEntries', 'weighIns', 'recipes', 'mealTemplates', 'scannedProducts']),
  clientId: z.string().min(1).max(100), operation: z.enum(['upsert', 'delete']),
  payload: z.record(z.string(), z.unknown()).nullable(), updatedAt: z.number().int().nonnegative().max(8_640_000_000_000_000),
})

export function validateMutation(input: unknown): ValidMutation | null {
  const checked = envelope.safeParse(input)
  if (!checked.success) return null
  const mutation = checked.data
  if (mutation.updatedAt > Date.now() + 24 * 60 * 60 * 1000) return null
  if (mutation.table !== 'scannedProducts' && !uuid.safeParse(mutation.clientId).success) return null
  if (mutation.operation === 'delete') return { ...mutation, payload: null }
  const payload = payloads[mutation.table].safeParse(mutation.payload)
  if (!payload.success) return null
  if (mutation.table === 'scannedProducts' && (payload.data as { barcode: string }).barcode !== mutation.clientId) return null
  return { ...mutation, payload: payload.data }
}
