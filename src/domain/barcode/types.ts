export interface ParsedProductMacros {
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
  sugar?: number
  saturatedFat?: number
  sodium?: number
}

export interface ParsedProduct {
  barcode: string
  name: string
  brand?: string
  imageUrl?: string
  per100g: ParsedProductMacros
  perServing?: ParsedProductMacros
  /** Grams, parsed from the source's serving-size text. */
  servingSize?: number
  /** The source's raw serving-size text, e.g. "75 g" or "2 x 40g" — kept for display. */
  servingSizeText?: string
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
