function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Parses grams out of a barcode source's free-text serving-size/quantity
 * field — "75 g", "2 x 40g" (a multi-pack: count × unit weight), "250 ml"
 * (liquids, treated as 1 ml ≈ 1 g), or a household-unit description with the
 * gram/ml equivalent in parentheses, e.g. "1 bar (40g)", "2 biscuits (20 g)",
 * "1 cup (240 ml)" — very common in real Open Food Facts data and the reason
 * this isn't just a single leading-number regex. Returns undefined when
 * unparsable.
 */
/**
 * Gram/millilitre unit, spelled out or abbreviated. Longest alternatives
 * first so "40 grams" matches `grams` rather than matching `g` and then
 * failing the trailing word boundary — which is what made every
 * spelled-out serving size unparseable before.
 */
const UNIT = '(?:grams|gramme|grammes|gram|millilitres|milliliters|millilitre|milliliter|ml|g)'

export function parseServingSize(text: string | undefined): number | undefined {
  if (!text) return undefined
  const trimmed = text.trim()

  const multiPack = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`, 'i'))
  if (multiPack) {
    const count = Number(multiPack[1])
    const unit = Number(multiPack[2])
    return Number.isFinite(count) && Number.isFinite(unit) ? round1(count * unit) : undefined
  }

  const single = trimmed.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\b`, 'i'))
  if (single) {
    const value = Number(single[1])
    return Number.isFinite(value) ? value : undefined
  }

  const parenthetical = trimmed.match(new RegExp(`\\(\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}\\s*\\)`, 'i'))
  if (parenthetical) {
    const value = Number(parenthetical[1])
    return Number.isFinite(value) ? value : undefined
  }

  return undefined
}
