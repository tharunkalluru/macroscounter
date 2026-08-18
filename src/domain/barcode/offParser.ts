import type { ParsedProduct } from './types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Parses grams out of an OFF quantity/serving_size string like "500 g" or "10g". Returns undefined if unparsable. */
function parseGrams(text: string | undefined): number | undefined {
  if (!text) return undefined
  const match = text.match(/([\d.]+)\s*g\b/i)
  if (!match) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) ? value : undefined
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

  const per100g = { kcal: round1(kcal100), p: round1(p100), c: round1(c100), f: round1(f100) }

  const kcalServing = nutriments?.['energy-kcal_serving']
  const pServing = nutriments?.['proteins_serving']
  const cServing = nutriments?.['carbohydrates_serving']
  const fServing = nutriments?.['fat_serving']
  const hasServing =
    typeof kcalServing === 'number' &&
    typeof pServing === 'number' &&
    typeof cServing === 'number' &&
    typeof fServing === 'number'

  return {
    barcode,
    name: typeof product.product_name === 'string' ? product.product_name : 'Unknown product',
    brand: typeof product.brands === 'string' ? product.brands : undefined,
    per100g,
    perServing: hasServing
      ? {
          kcal: round1(kcalServing as number),
          p: round2(pServing as number),
          c: round2(cServing as number),
          f: round2(fServing as number),
        }
      : undefined,
    servingSize: parseGrams(product.serving_size as string | undefined),
    quantity: parseGrams(product.quantity as string | undefined),
    source: 'off',
  }
}
