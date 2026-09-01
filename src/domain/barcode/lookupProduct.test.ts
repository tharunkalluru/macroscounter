import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MacroDesiDB } from '../../data/db'
import type { ScannedProduct } from '../../data/models'
import { ScannedProductRepo } from '../../data/repos/ScannedProductRepo'
import amulButter from './fixtures/off-amul-butter.json'
import offNotFound from './fixtures/off-not-found.json'
import fdcBranded from './fixtures/fdc-search-branded.json'
import fdcEmpty from './fixtures/fdc-search-empty.json'
import multipackBiscuits from './fixtures/off-multipack-biscuits.json'
import { lookupProduct } from './lookupProduct'

let db: MacroDesiDB
let repo: ScannedProductRepo

beforeEach(() => {
  db = new MacroDesiDB(`test-lookup-${Math.random()}`)
  repo = new ScannedProductRepo(db)
})

afterEach(async () => {
  await db.delete()
})

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

describe('lookupProduct — chain order', () => {
  it('a cache hit short-circuits before any network call', async () => {
    const cached: ScannedProduct = {
      barcode: '8901491101615',
      name: 'Amul Butter',
      per100g: { kcal: 717, p: 0.5, c: 0.1, f: 80 },
      source: 'off',
      firstScanned: '2026-08-01',
    }
    await repo.put(cached)

    const fetchImpl = vi.fn()
    const result = await lookupProduct('8901491101615', { scannedProductRepo: repo, fetchImpl })

    expect(result.source).toBe('cache')
    expect(result.product?.name).toBe('Amul Butter')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('falls through to OFF on a cache miss, then caches the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(amulButter))
    const result = await lookupProduct('8901491101615', { scannedProductRepo: repo, fetchImpl })

    expect(result.source).toBe('off')
    expect(result.product?.name).toBe('Amul Butter')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toContain('openfoodfacts.org')

    // Second lookup for the same barcode now hits cache, no more network calls.
    fetchImpl.mockClear()
    const second = await lookupProduct('8901491101615', { scannedProductRepo: repo, fetchImpl })
    expect(second.source).toBe('cache')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('falls through to FDC when OFF misses and an API key is configured', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(offNotFound))
      .mockResolvedValueOnce(jsonResponse(fdcBranded))

    const result = await lookupProduct('0012345678905', {
      scannedProductRepo: repo,
      fetchImpl,
      fdcApiKey: 'test-key',
    })

    expect(result.source).toBe('fdc')
    expect(result.product?.name).toBe('CHOCOLATE CHIP COOKIES')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('api.nal.usda.gov')
  })

  it('does not call FDC at all when no API key is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(offNotFound))
    const result = await lookupProduct('0000000000000', { scannedProductRepo: repo, fetchImpl })

    expect(result.source).toBe('not-found')
    expect(fetchImpl).toHaveBeenCalledTimes(1) // OFF only
  })

  it('returns not-found when both OFF and FDC miss', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(offNotFound))
      .mockResolvedValueOnce(jsonResponse(fdcEmpty))

    const result = await lookupProduct('0000000000000', {
      scannedProductRepo: repo,
      fetchImpl,
      fdcApiKey: 'test-key',
    })
    expect(result.source).toBe('not-found')
    expect(result.product).toBeNull()
  })

  it('treats a network error as a miss and falls through the chain gracefully', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const result = await lookupProduct('0000000000000', { scannedProductRepo: repo, fetchImpl })
    expect(result.source).toBe('not-found')
  })

  it('persists imageUrl/servingSizeText/quantity to the cache, not just at first-parse time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(multipackBiscuits))
    const result = await lookupProduct('8901030811234', { scannedProductRepo: repo, fetchImpl })

    expect(result.product?.imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/890/103/081/1234/front.jpg'
    )
    expect(result.product?.servingSizeText).toBe('40 g')
    expect(result.product?.quantity).toBe(80) // "2 x 40 g" -> the pack chips depend on this

    // Confirm it actually round-trips through the cache (was previously
    // dropped by toScannedProduct(), so quantity/imageUrl only survived
    // for the first, never-cached response).
    fetchImpl.mockClear()
    const cached = await lookupProduct('8901030811234', { scannedProductRepo: repo, fetchImpl })
    expect(cached.source).toBe('cache')
    expect(cached.product?.quantity).toBe(80)
    expect(cached.product?.imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/890/103/081/1234/front.jpg'
    )
  })
})

describe('lookupProduct — per-source opt-out (Settings > Food log defaults)', () => {
  it('skips OFF entirely when disabled, going straight to FDC', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(fdcBranded))
    const result = await lookupProduct('0012345678905', {
      scannedProductRepo: repo,
      fetchImpl,
      fdcApiKey: 'test-key',
      sourcesEnabled: { off: false, fdc: true },
    })

    expect(result.source).toBe('fdc')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toContain('api.nal.usda.gov')
  })

  it('skips FDC entirely when disabled, even with an API key configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(offNotFound))
    const result = await lookupProduct('0000000000000', {
      scannedProductRepo: repo,
      fetchImpl,
      fdcApiKey: 'test-key',
      sourcesEnabled: { off: true, fdc: false },
    })

    expect(result.source).toBe('not-found')
    expect(fetchImpl).toHaveBeenCalledTimes(1) // OFF only, FDC never attempted
  })

  it('disabling both sources returns not-found without any network call', async () => {
    const fetchImpl = vi.fn()
    const result = await lookupProduct('0000000000000', {
      scannedProductRepo: repo,
      fetchImpl,
      fdcApiKey: 'test-key',
      sourcesEnabled: { off: false, fdc: false },
    })

    expect(result.source).toBe('not-found')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('lookupProduct — not-found -> manual save -> second scan hits cache offline', () => {
  it('a manually saved product is found offline on the next scan without any network call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(offNotFound))
    const firstScan = await lookupProduct('9999999999999', { scannedProductRepo: repo, fetchImpl })
    expect(firstScan.source).toBe('not-found')

    // User goes through the not-found flow and manually confirms macros.
    await repo.put({
      barcode: '9999999999999',
      name: 'Homemade Protein Bar',
      per100g: { kcal: 380, p: 25, c: 40, f: 12 },
      source: 'manual',
      firstScanned: '2026-08-18',
    })

    // Second scan, now fully offline (fetch throws if ever called).
    const offlineFetch = vi.fn().mockRejectedValue(new Error('offline'))
    const secondScan = await lookupProduct('9999999999999', {
      scannedProductRepo: repo,
      fetchImpl: offlineFetch,
    })

    expect(secondScan.source).toBe('cache')
    expect(secondScan.product?.name).toBe('Homemade Protein Bar')
    expect(offlineFetch).not.toHaveBeenCalled()
  })
})
