import type { Portion } from '../fooddb/types'
import type { ParsedProduct } from './types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Household-ish portions for a scanned product: "1 serving" from OFF's
 * serving_size, "1 pack" / "½ pack" from the package quantity, falling back
 * to a plain 100g option when neither is known.
 */
export function getServingOptions(product: Pick<ParsedProduct, 'servingSize' | 'quantity'>): Portion[] {
  const options: Portion[] = []

  if (product.servingSize) {
    options.push({ label: '1 serving', grams: product.servingSize })
  }
  if (product.quantity) {
    options.push({ label: '1 pack', grams: product.quantity })
    options.push({ label: '½ pack', grams: round1(product.quantity / 2) })
  }
  if (options.length === 0) {
    options.push({ label: '100 g', grams: 100 })
  }
  return options
}
