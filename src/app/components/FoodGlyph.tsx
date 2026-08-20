const PALETTE = ['bg-brand-500', 'bg-protein-500', 'bg-carbs-500', 'bg-fat-500'] as const

const SIZE_CLASSES = {
  default: 'h-9 w-9 text-sm',
  small: 'h-6 w-6 text-xs',
} as const

/** Deterministic small-int hash — same name always gets the same color, no state/lookup needed. */
function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

interface Props {
  name: string
  /** 'default' for list rows, 'small' for compact chips. A dedicated prop, not a className size
   *  override — Tailwind utilities of the same property don't reliably override by source order,
   *  so passing conflicting sizing classes via className wouldn't deterministically win. */
  size?: keyof typeof SIZE_CLASSES
}

/**
 * Small colored initial-letter avatar for a food/entry row — gives every row
 * a distinct visual identity without a photo asset pipeline (the curated
 * food DB has no images). Color is hashed from the name into the app's own
 * brand/macro palette, never a new off-token hue.
 */
export default function FoodGlyph({ name, size = 'default' }: Props) {
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  const colorClass = PALETTE[hashName(name) % PALETTE.length]

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZE_CLASSES[size]} ${colorClass}`}
    >
      {letter}
    </span>
  )
}
