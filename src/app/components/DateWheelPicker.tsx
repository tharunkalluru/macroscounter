const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const SELECT_CLASS =
  'min-h-touch w-full appearance-none rounded-card border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 dark:border-slate-600 dark:bg-surface-dark-card dark:text-slate-100'

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

interface Props {
  /** yyyy-mm-dd, or '' if nothing picked yet. */
  valueISO: string
  onChange: (iso: string) => void
  /** Latest selectable date (yyyy-mm-dd) — the year column stops here. */
  maxISO: string
}

/**
 * A 3-column month/day/year date picker (the design's DOB wheel, frame 2).
 * Built from native `<select>`s rather than a hand-rolled scroll-snap
 * wheel — same 3-column structure and keyboard/screen-reader support the
 * design's own picker needs, without the touch-physics engineering a real
 * spinning wheel would take on for what's one onboarding field.
 */
export default function DateWheelPicker({ valueISO, onChange, maxISO }: Props) {
  const [maxY, maxM, maxD] = maxISO.split('-').map(Number)
  const [y, m, d] = valueISO ? valueISO.split('-').map(Number) : [maxY - 25, maxM, maxD]

  const minYear = maxY - 100
  const years: number[] = []
  for (let year = maxY; year >= minYear; year--) years.push(year)

  const dayCount = daysInMonth(y, m)
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  function update(nextY: number, nextM: number, nextD: number) {
    const clampedDay = Math.min(nextD, daysInMonth(nextY, nextM))
    onChange(`${nextY}-${pad2(nextM)}-${pad2(clampedDay)}`)
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Date of birth">
      <select
        aria-label="Month"
        data-testid="dob-month"
        className={SELECT_CLASS}
        value={m}
        onChange={(e) => update(y, Number(e.target.value), d)}
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label="Day"
        data-testid="dob-day"
        className={SELECT_CLASS}
        value={Math.min(d, dayCount)}
        onChange={(e) => update(y, m, Number(e.target.value))}
      >
        {days.map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        data-testid="dob-year"
        className={SELECT_CLASS}
        value={y}
        onChange={(e) => update(Number(e.target.value), m, d)}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}
