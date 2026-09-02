interface Props {
  points: number[]
  className?: string
}

/** A minimal trend line with no axes/gridlines — used wherever a small inline chart is enough (weigh-in entry, expenditure history). */
export default function Sparkline({ points, className }: Props) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 100
  const h = 40
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w
    const y = h - ((p - min) / range) * h
    return `${x},${y}`
  })
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className ?? 'h-10 w-full'}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={coords.join(' ')} fill="none" className="stroke-brand-600 dark:stroke-brand-400" strokeWidth={2} />
    </svg>
  )
}
