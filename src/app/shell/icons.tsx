interface IconProps {
  active?: boolean
  className?: string
}

/**
 * Phase F.0: every icon in this file now renders a Phosphor glyph (loaded
 * via the CDN links in index.html) instead of a hand-drawn SVG, matching
 * the source design exactly. Every exported component keeps its original
 * name and `{active, className}` prop shape, so no call site outside this
 * file needed to change. Color comes from the surrounding text color
 * (`currentColor` is how Phosphor's font icons work, same mental model as
 * the old `stroke="currentColor"` SVGs); size is set per-icon below to
 * match each glyph's previous footprint.
 */
function Ph({
  name,
  variant = 'regular',
  size,
  className,
}: {
  name: string
  variant?: 'regular' | 'fill' | 'bold'
  size: number
  className?: string
}) {
  const prefix = variant === 'regular' ? 'ph' : `ph-${variant}`
  return (
    <i
      className={`${prefix} ph-${name}${className ? ` ${className}` : ''}`}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    />
  )
}

export function TodayIcon({ active, className }: IconProps) {
  return <Ph name="house" variant={active ? 'fill' : 'regular'} size={22} className={className} />
}

export function LogIcon({ active, className }: IconProps) {
  return <Ph name="list-dashes" variant={active ? 'fill' : 'regular'} size={22} className={className} />
}

/** The center tab-bar FAB — the design renders this as a plain bold plus, not a scan glyph. */
export function PlusIcon({ className }: IconProps) {
  return <Ph name="plus" variant="bold" size={22} className={className} />
}

export function TrendsIcon({ className }: IconProps) {
  return <Ph name="chart-line" size={22} className={className} />
}

export function CoachIcon({ active, className }: IconProps) {
  return <Ph name="sparkle" variant={active ? 'fill' : 'regular'} size={22} className={className} />
}

export function BarcodeIcon({ className }: IconProps) {
  return <Ph name="barcode" size={20} className={className} />
}

export function FlameIcon({ className }: IconProps) {
  return <Ph name="flame" variant="fill" size={14} className={className} />
}

export function TargetIcon({ className }: IconProps) {
  return <Ph name="target" size={18} className={className} />
}

export function FlashlightIcon({ className }: IconProps) {
  return <Ph name="flashlight" size={18} className={className} />
}

export function CameraIcon({ className }: IconProps) {
  return <Ph name="camera" size={20} className={className} />
}

export function InstallIcon({ className }: IconProps) {
  return <Ph name="download-simple" size={20} className={className} />
}

export function SparkleIcon({ className }: IconProps) {
  return <Ph name="sparkle" size={18} className={className} />
}

export function HeartIcon({ active, className }: IconProps) {
  return <Ph name="heart" variant={active ? 'fill' : 'regular'} size={20} className={className} />
}

/** Date-stepper chevrons (calendar/date-strip prev-next) — distinct from
 *  back-navigation, which is `ArrowLeftIcon` below. */
export function ChevronLeftIcon({ className }: IconProps) {
  return <Ph name="caret-left" size={20} className={className} />
}

export function ChevronRightIcon({ className }: IconProps) {
  return <Ph name="caret-right" size={20} className={className} />
}

/** Back-navigation on a full-screen page/wizard header. */
export function ArrowLeftIcon({ className }: IconProps) {
  return <Ph name="arrow-left" size={20} className={className} />
}

export function ForkKnifeIcon({ className }: IconProps) {
  return <Ph name="fork-knife" size={18} className={className} />
}

export function PaletteIcon({ className }: IconProps) {
  return <Ph name="palette" size={18} className={className} />
}

export function TrashIcon({ className }: IconProps) {
  return <Ph name="trash" size={18} className={className} />
}

export function MicIcon({ active, className }: IconProps) {
  return <Ph name="microphone" variant={active ? 'fill' : 'regular'} size={18} className={className} />
}

/** Grab handle for dragging a logged entry between meal sections. */
export function DragHandleIcon({ className }: IconProps) {
  return <Ph name="dots-six-vertical" size={18} className={className} />
}
