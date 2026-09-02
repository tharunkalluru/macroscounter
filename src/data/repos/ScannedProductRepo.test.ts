import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import type { ScannedProduct } from '../models'
import { ScannedProductRepo } from './ScannedProductRepo'

const sample: ScannedProduct = {
  barcode: '8901491101615',
  name: 'Amul Butter',
  brand: 'Amul',
  per100g: { kcal: 717, p: 0.5, c: 0.1, f: 80 },
  perServing: { kcal: 71.7, p: 0.05, c: 0.01, f: 8 },
  servingSize: 10,
  source: 'off',
  firstScanned: '2026-08-18',
}

let db: BitewiseDB
let repo: ScannedProductRepo

beforeEach(() => {
  db = new BitewiseDB(`test-scannedproduct-${Math.random()}`)
  repo = new ScannedProductRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('ScannedProductRepo', () => {
  it('returns undefined for an unknown barcode', async () => {
    expect(await repo.get('0000000000000')).toBeUndefined()
  })

  it('round-trips a scanned product keyed by barcode', async () => {
    await repo.put(sample)
    const found = await repo.get('8901491101615')
    expect(found?.name).toBe('Amul Butter')
  })

  it('getMany fetches multiple barcodes, skipping unknown ones', async () => {
    await repo.put(sample)
    const results = await repo.getMany(['8901491101615', '0000000000000'])
    expect(results).toHaveLength(1)
    expect(results[0].barcode).toBe('8901491101615')
  })
})
