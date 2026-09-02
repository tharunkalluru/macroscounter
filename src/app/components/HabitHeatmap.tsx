interface Props {
  /** Oldest-to-newest ordered list of the last N days, each true if logged. */
  days: { date: string; logged: boolean }[]
  columns?: number
}

/** The 30-day (2×15) logging heatmap — the design's most distinctive Habits-screen visual (frame 28). */
export default function HabitHeatmap({ days, columns = 15 }: Props) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      data-testid="habit-heatmap"
    >
      {days.map((day, i) => {
        const isToday = i === days.length - 1
        return (
          <div
            key={day.date}
            data-testid={`heatmap-day-${day.date}`}
            data-logged={day.logged}
            title={day.date}
            className={`aspect-square rounded-sm ${
              day.logged
                ? 'bg-brand-600 dark:bg-brand-400'
                : isToday
                  ? 'bg-transparent ring-1 ring-inset ring-brand-600 dark:ring-brand-400'
                  : 'bg-slate-100 dark:bg-slate-800'
            }`}
          />
        )
      })}
    </div>
  )
}
