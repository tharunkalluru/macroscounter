import type { ScannedProduct } from '../../data/models'
import type { ScannedProductRepo } from '../../data/repos/ScannedProductRepo'
import { todayISO } from '../../lib/date'
import { parseFDCResponse } from './fdcParser'
import { parseOFFResponse } from './offParser'
import type { ParsedProduct } from './types'

const OFF_URL = (barcode: string) => `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
const FDC_URL = (barcode: string, apiKey: string) =>
  `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&dataType=Branded&api_key=${apiKey}`

export type LookupSource = 'cache' | 'off' | 'fdc' | 'not-found'

export interface LookupResult {
  product: ScannedProduct | null
  source: LookupSource
}

export interface LookupDeps {
  scannedProductRepo: ScannedProductRepo
  fetchImpl?: typeof fetch
  fdcApiKey?: string
}

function toScannedProduct(parsed: ParsedProduct): ScannedProduct {
  return {
    barcode: parsed.barcode,
    name: parsed.name,
    brand: parsed.brand,
    per100g: parsed.per100g,
    perServing: parsed.perServing,
    servingSize: parsed.servingSize,
    source: parsed.source,
    firstScanned: todayISO(),
  }
}

/**
 * Lookup chain: local `scannedProducts` cache -> Open Food Facts -> USDA FDC
 * (only if an API key is configured) -> not-found. A cache hit short-circuits
 * before any network call is made, which is what makes re-scanning an
 * already-seen product work offline.
 */
export async function lookupProduct(barcode: string, deps: LookupDeps): Promise<LookupResult> {
  const cached = await deps.scannedProductRepo.get(barcode)
  if (cached) return { product: cached, source: 'cache' }

  const fetchImpl = deps.fetchImpl ?? fetch

  try {
    const offRes = await fetchImpl(OFF_URL(barcode))
    if (offRes.ok) {
      const parsed = parseOFFResponse(barcode, await offRes.json())
      if (parsed) {
        const product = toScannedProduct(parsed)
        await deps.scannedProductRepo.put(product)
        return { product, source: 'off' }
      }
    }
  } catch {
    // Network or OFF failure: fall through to FDC / not-found.
  }

  if (deps.fdcApiKey) {
    try {
      const fdcRes = await fetchImpl(FDC_URL(barcode, deps.fdcApiKey))
      if (fdcRes.ok) {
        const parsed = parseFDCResponse(barcode, await fdcRes.json())
        if (parsed) {
          const product = toScannedProduct(parsed)
          await deps.scannedProductRepo.put(product)
          return { product, source: 'fdc' }
        }
      }
    } catch {
      // Network or FDC failure: fall through to not-found.
    }
  }

  return { product: null, source: 'not-found' }
}
