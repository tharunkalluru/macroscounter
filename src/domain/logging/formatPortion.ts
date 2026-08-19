export interface PortionInput {
  qty: number
  unit: 'portion' | 'grams'
  grams: number
  /** The picked portion's raw label, e.g. "1 idli" or "1 large latte". */
  portionLabel?: string
  isCustom?: boolean
}

const LEADING_COUNT = /^(\d+(?:\.\d+)?)\s+(.+)$/

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Renders a count as "2", "1½", or "½" — falls back to a plain decimal for non-half fractions. */
function formatCount(n: number): string {
  const rounded = round2(n)
  const whole = Math.floor(rounded)
  const remainder = round2(rounded - whole)

  if (remainder === 0) return String(whole)
  if (Math.abs(remainder - 0.5) < 1e-9) return whole === 0 ? '½' : `${whole}½`
  return String(rounded)
}

/**
 * Renders a logged portion in household units, e.g. "3 idli", "1½ idli",
 * "1 large latte" — never a raw multiplier like "3.13 x 100 g". Falls back to
 * a plain gram amount when there's no household-unit portion to work with
 * (custom/quick-add entries, or a portion label the app can't parse).
 */
export function formatPortion(entry: PortionInput): string {
  if (entry.isCustom) return 'Custom entry'

  if (entry.unit !== 'portion' || !entry.portionLabel) {
    return `${Math.round(entry.grams)} g`
  }

  const match = entry.portionLabel.match(LEADING_COUNT)
  if (!match) return entry.portionLabel

  const baseCount = Number(match[1])
  const noun = match[2]
  const totalCount = entry.qty * baseCount

  return `${formatCount(totalCount)} ${noun}`
}
