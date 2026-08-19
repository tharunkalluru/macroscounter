import { trackUpsert } from '../../lib/sync/syncTracker'
import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { ScannedProduct } from '../models'

export class ScannedProductRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async get(barcode: string): Promise<ScannedProduct | undefined> {
    return this.db.scannedProducts.get(barcode)
  }

  async put(product: ScannedProduct): Promise<string> {
    // The barcode is already a globally stable identifier, so it doubles as
    // this table's sync clientId — no separate uuid needed, and it means
    // two devices scanning the same product converge on one cached row
    // instead of two.
    const barcode = await this.db.scannedProducts.put({ ...product, clientId: product.barcode })
    const saved = await this.db.scannedProducts.get(barcode)
    if (saved) await trackUpsert(this.db, 'scannedProducts', barcode, saved)
    return barcode
  }

  async getMany(barcodes: string[]): Promise<ScannedProduct[]> {
    const results = await this.db.scannedProducts.bulkGet(barcodes)
    return results.filter((p): p is ScannedProduct => p !== undefined)
  }
}
