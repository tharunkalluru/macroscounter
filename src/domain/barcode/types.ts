export interface ParsedProductMacros {
  kcal: number
  p: number
  c: number
  f: number
}

export interface ParsedProduct {
  barcode: string
  name: string
  brand?: string
  per100g: ParsedProductMacros
  perServing?: ParsedProductMacros
  servingSize?: number
  quantity?: number
  source: 'off' | 'fdc' | 'manual'
}

export interface ParsedLabel {
  name?: string
  per100g?: Partial<ParsedProductMacros>
}

/**
 * Reads a nutrition-label photo into structured macros. `VisionApiLabelReader`
 * is used when a vision API key is configured (see .env.example); otherwise
 * `NullLabelReader` always returns null and the UI falls back to a manual
 * entry form.
 */
export interface LabelReader {
  readLabel(image: Blob): Promise<ParsedLabel | null>
}
