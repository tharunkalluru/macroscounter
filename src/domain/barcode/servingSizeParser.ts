function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Parses grams out of a barcode source's free-text serving-size/quantity
 * field — "75 g", "2 x 40g" (a multi-pack: count × unit weight), or "250 ml"
 * (liquids, treated as 1 ml ≈ 1 g). Returns undefined when unparsable.
 */
export function parseServingSize(text: string | undefined): number | undefined {
  if (!text) return undefined
  const trimmed = text.trim()

  const multiPack = trimmed.match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i)
  if (multiPack) {
    const count = Number(multiPack[1])
    const unit = Number(multiPack[2])
    return Number.isFinite(count) && Number.isFinite(unit) ? round1(count * unit) : undefined
  }

  const single = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i)
  if (single) {
    const value = Number(single[1])
    return Number.isFinite(value) ? value : undefined
  }

  return undefined
}
