import { addDaysISO, todayISO } from '../../lib/date'

interface Props {
  selectedDate: string
  onSelect: (date: string) => void
  days?: number
}

/**
 * Horizontally-scrollable strip of the last N days (the design's Log-tab
 * date strip, frame 12) — native overflow-x scroll doubles as the swipe
 * gesture on touch devices. Selecting a day drives both the Meals and
 * Timeline views on the same screen.
 */
export default function DateStrip({ selectedDate, onSelect, days = 7 }: Props) {
  const today = todayISO()
  const dates = Array.from({ length: days }, (_, i) => addDaysISO(today, i - (days - 1)))

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Select date">
      {dates.map((d) => {
        const selected = d === selectedDate
        const dt = new Date(d + 'T00:00:00')
        const weekdayLetter = dt.toLocaleDateString('en-US', { weekday: 'short' })[0]
        const dayNum = dt.getDate()
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`date-strip-${d}`}
            onClick={() => onSelect(d)}
            className={`flex min-h-touch min-w-touch flex-none flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 transition-transform active:scale-95 ${
              selected
                ? 'bg-brand-100 text-brand-700 dark:bg-slate-700 dark:text-brand-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-[10px] font-mono uppercase tracking-wide">{weekdayLetter}</span>
            <span className="text-sm font-semibold tabular-nums">{dayNum}</span>
          </button>
        )
      })}
    </div>
  )
}
