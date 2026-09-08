import { addDaysISO, isFutureDate, isValidISODate, todayISO } from '../../lib/date'
import { ChevronLeftIcon, ChevronRightIcon } from '../shell/icons'

interface Props {
  date: string
  onChange: (date: string) => void
}

function formatLabel(date: string): string {
  const today = todayISO()
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const monthDay = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (date === today) return `Today, ${monthDay}`
  if (date === addDaysISO(today, -1)) return `Yesterday, ${monthDay}`
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' })
  return `${weekday}, ${monthDay}`
}

export default function DateNav({ date, onChange }: Props) {
  const nextDate = addDaysISO(date, 1)
  const nextDisabled = isFutureDate(nextDate)

  return (
    <div
      className="mx-auto flex max-w-md items-center justify-center gap-1 px-6"
      data-testid="date-nav"
    >
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(addDaysISO(date, -1))}
        className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ChevronLeftIcon />
      </button>
      <label
        className="relative flex min-h-touch min-w-[10rem] cursor-pointer items-center justify-center rounded-lg px-2 text-center text-body font-medium text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
        data-testid="date-nav-label"
      >
        {formatLabel(date)}
        <input
          type="date"
          aria-label="Choose diary date"
          value={date}
          max={todayISO()}
          onChange={(event) => {
            const value = event.target.value
            if (isValidISODate(value) && !isFutureDate(value)) onChange(value)
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onClick={(event) => event.currentTarget.showPicker?.()}
        />
      </label>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => !nextDisabled && onChange(nextDate)}
        disabled={nextDisabled}
        className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ChevronRightIcon />
      </button>
    </div>
  )
}
