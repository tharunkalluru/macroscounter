const SIZE_CLASSES = {
  default: 'h-10 w-10 rounded-xl',
  small: 'h-7 w-7 rounded-lg',
} as const

// These are decorative recognition cues, never nutrition classifications.
// An unfamiliar name gets the same neutral bowl as a mixed meal.
const FOOD_ICONS = [
  { matches: /\b(coffee|tea|chai|latte|cappuccino|milk|lassi|juice|smoothie|shake|water)\b/i, paths: ['M5 8h11v7a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z', 'M16 9h1a3 3 0 0 1 0 6h-1', 'M8 3v2m5-2v2'] },
  { matches: /\b(apple|banana|orange|mango|berry|berries|grapes|grape|fruit|pear|peach|melon)\b/i, paths: ['M12 7c-2-2-6-2-7 1-2 4 1 11 4 12 1 .4 2-.5 3-.5s2 .9 3 .5c3-1 6-8 4-12-1-3-5-3-7-1Z', 'M12 7V4m0 1c0-3 3-3 4-3 0 2-1 4-4 3'] },
  { matches: /\b(egg|eggs|omelet|omelette|omelettee)\b/i, paths: ['M19 14c0 4-3 7-7 7s-7-3-7-7S9 3 12 3s7 7 7 11Z', 'M8 14c0 2 1 3 3 3'] },
  { matches: /\b(bread|toast|sandwich|roti|chapati|chapathi|naan|paratha|parotta|pita|bagel)\b/i, paths: ['M6 11C1 9 4 3 9 4c2-2 6-1 7 0 5-1 8 5 3 7v9H6v-9Z', 'M9 13v4m7-4v4'] },
  { matches: /\b(salad|spinach|broccoli|greens|vegetable|vegetables|avocado|kale|cucumber)\b/i, paths: ['M19 4c-8-1-14 2-14 8a6 6 0 0 0 6 6c6 0 9-6 8-14Z', 'M5 21 15 10m-7 8v-5m0 5h5'] },
  { matches: /\b(fish|salmon|tuna|cod|prawn|prawns|shrimp|seafood)\b/i, paths: ['M4 12c3-6 10-6 14-2l3-3v10l-3-3c-4 4-11 4-14-2Z', 'M13 8c-2 2-2 6 0 8', 'M7 11h.01'] },
  { matches: /\b(chicken|turkey|meat|beef|lamb|mutton|pork|steak)\b/i, paths: ['M10 16c-3-3-3-7 0-10s7-3 9-1 2 6-1 9-5 3-8 2Z', 'M10 16 7 19a2 2 0 1 1-3-2 2 2 0 1 1 2-3l3-3'] },
] as const

const BOWL_PATHS = ['M3 10h18c-.5 6-4 9-9 9s-8.5-3-9-9Z', 'M8 21h8', 'M8 6V3m4 3V2m4 4V3']

interface Props {
  name: string
  /** 'default' for list rows, 'small' for compact chips. A dedicated prop, not a className size
   *  override — Tailwind utilities of the same property don't reliably override by source order,
   *  so passing conflicting sizing classes via className wouldn't deterministically win. */
  size?: keyof typeof SIZE_CLASSES
}

/** A quiet food cue, drawn in the same stroke style across search and diary. */
export default function FoodGlyph({ name, size = 'default' }: Props) {
  const paths = FOOD_ICONS.find((icon) => icon.matches.test(name))?.paths ?? BOWL_PATHS

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400 ${SIZE_CLASSES[size]}`}
    >
      <svg width={size === 'small' ? 17 : 22} height={size === 'small' ? 17 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {paths.map((path) => <path key={path} d={path} />)}
      </svg>
    </span>
  )
}
