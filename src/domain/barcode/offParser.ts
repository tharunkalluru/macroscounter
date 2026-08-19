import { parseServingSize } from './servingSizeParser'
import type { ParsedProduct } from './types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Parses an Open Food Facts v2 `/api/v2/product/{barcode}.json` response.
 * Returns null when the product wasn't found or lacks usable calorie/macro
 * data (e.g. an empty `nutriments` object) rather than throwing — callers
 * treat a null result the same as a lookup miss and fall through the chain.
 */
export function parseOFFResponse(barcode: string, json: unknown): ParsedProduct | null {
  if (typeof json !== 'object' || json === null) return null
  const body = json as Record<string, unknown>

  if (body.status !== 1) return null
  const product = body.product as Record<string, unknown> | undefined
  if (!product) return null

  const nutriments = product.nutriments as Record<string, unknown> | undefined
  const kcal100 = nutriments?.['energy-kcal_100g']
  const p100 = nutriments?.['proteins_100g']
  const c100 = nutriments?.['carbohydrates_100g']
  const f100 = nutriments?.['fat_100g']

  if (
    typeof kcal100 !== 'number' ||
    typeof p100 !== 'number' ||
    typeof c100 !== 'number' ||
    typeof f100 !== 'number'
  ) {
    return null
  }

  const numField = (key: string): number | undefined => {
    const v = nutriments?.[key]
    return typeof v === 'number' ? v : undefined
  }
  const optionalRound = (value: number | undefined, round: (n: number) => number) =>
    value === undefined ? undefined : round(value)

  const per100g = {
    kcal: round1(kcal100),
    p: round1(p100),
    c: round1(c100),
    f: round1(f100),
    fiber: optionalRound(numField('fiber_100g'), round1),
    sugar: optionalRound(numField('sugars_100g'), round1),
    saturatedFat: optionalRound(numField('saturated-fat_100g'), round1),
    sodium: optionalRound(numField('sodium_100g'), round2),
  }

  const kcalServing = nutriments?.['energy-kcal_serving']
  const pServing = nutriments?.['proteins_serving']
  const cServing = nutriments?.['carbohydrates_serving']
  const fServing = nutriments?.['fat_serving']
  const hasServing =
    typeof kcalServing === 'number' &&
    typeof pServing === 'number' &&
    typeof cServing === 'number' &&
    typeof fServing === 'number'

  const servingSizeText = product.serving_size as string | undefined

  return {
    barcode,
    name: typeof product.product_name === 'string' ? product.product_name : 'Unknown product',
    brand: typeof product.brands === 'string' ? product.brands : undefined,
    imageUrl: typeof product.image_url === 'string' ? product.image_url : undefined,
    per100g,
    perServing: hasServing
      ? {
          kcal: round1(kcalServing as number),
          p: round2(pServing as number),
          c: round2(cServing as number),
          f: round2(fServing as number),
        }
      : undefined,
    servingSize: parseServingSize(servingSizeText),
    servingSizeText,
    quantity: parseServingSize(product.quantity as string | undefined),
    source: 'off',
  }
}
