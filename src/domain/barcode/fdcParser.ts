import type { ParsedProduct } from './types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

interface FdcNutrient {
  nutrient?: { name?: string }
  amount?: number
}

function findAmount(nutrients: FdcNutrient[], name: string): number | undefined {
  const match = nutrients.find((n) => n.nutrient?.name === name)
  return typeof match?.amount === 'number' ? match.amount : undefined
}

/**
 * Parses a USDA FoodData Central `/v1/foods/search` (Branded) response,
 * matching the first result whose `gtinUpc` equals the scanned barcode.
 * Returns null if there's no match or the matched food lacks core macros.
 */
export function parseFDCResponse(barcode: string, json: unknown): ParsedProduct | null {
  if (typeof json !== 'object' || json === null) return null
  const body = json as { foods?: unknown[] }
  if (!Array.isArray(body.foods) || body.foods.length === 0) return null

  const normalizedBarcode = barcode.replace(/^0+/, '')
  const food =
    (body.foods as Record<string, unknown>[]).find((f) => {
      const upc = typeof f.gtinUpc === 'string' ? f.gtinUpc.replace(/^0+/, '') : ''
      return upc === normalizedBarcode
    }) ?? (body.foods[0] as Record<string, unknown>)

  const nutrients = (food.foodNutrients as FdcNutrient[]) ?? []
  const kcal = findAmount(nutrients, 'Energy')
  const p = findAmount(nutrients, 'Protein')
  const c = findAmount(nutrients, 'Carbohydrate, by difference')
  const f = findAmount(nutrients, 'Total lipid (fat)')
  const fiber = findAmount(nutrients, 'Fiber, total dietary')

  if (kcal === undefined || p === undefined || c === undefined || f === undefined) return null

  const servingSize = typeof food.servingSize === 'number' ? food.servingSize : undefined

  return {
    barcode,
    name: typeof food.description === 'string' ? food.description : 'Unknown product',
    brand: typeof food.brandOwner === 'string' ? food.brandOwner : undefined,
    per100g: { kcal: round1(kcal), p: round1(p), c: round1(c), f: round1(f), fiber: fiber === undefined ? undefined : round1(fiber) },
    servingSize,
    source: 'fdc',
  }
}
