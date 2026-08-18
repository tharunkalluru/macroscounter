import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { ScannedProduct } from '../models'

export class ScannedProductRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async get(barcode: string): Promise<ScannedProduct | undefined> {
    return this.db.scannedProducts.get(barcode)
  }

  async put(product: ScannedProduct): Promise<string> {
    return this.db.scannedProducts.put(product)
  }

  async getMany(barcodes: string[]): Promise<ScannedProduct[]> {
    const results = await this.db.scannedProducts.bulkGet(barcodes)
    return results.filter((p): p is ScannedProduct => p !== undefined)
  }
}
