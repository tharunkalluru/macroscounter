import { Link } from 'react-router-dom'
import type { LogEntry, Meal } from '../../data/models'

interface Props {
  meal: Meal
  label: string
  entries: LogEntry[]
  onDelete: (id: number) => void
  /** ISO date this section belongs to. Omit for "today" (the Today dashboard's default). */
  date?: string
}

export default function MealSection({ meal, label, entries, onDelete, date }: Props) {
  const subtotalKcal = Math.round(entries.reduce((sum, e) => sum + e.kcal, 0))
  const dateSuffix = date ? `&date=${date}` : ''

  return (
    <section className="mt-6" data-testid={`meal-section-${meal}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-800">{label}</h2>
        <span className="text-sm text-slate-500" data-testid={`meal-subtotal-${meal}`}>
          {subtotalKcal} kcal
        </span>
      </div>

      <ul className="mt-2 divide-y divide-slate-100 rounded-lg bg-white shadow-sm">
        {entries.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500">Nothing logged yet.</li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{entry.name}</p>
              <p className="text-xs text-slate-500">
                {entry.portionSummary} · {Math.round(entry.kcal)} kcal
              </p>
            </div>
            <div className="flex shrink-0 gap-3 text-sm">
              <Link
                to={
                  entry.customSnapshot
                    ? `/log/quick-add?entryId=${entry.id}`
                    : `/log/edit/${entry.id}`
                }
                className="text-brand-700 underline"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={() => entry.id !== undefined && onDelete(entry.id)}
                className="text-red-600 underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-4 text-sm">
        <Link to={`/log/add?meal=${meal}${dateSuffix}`} className="text-brand-700 underline">
          + Add food
        </Link>
        <Link to={`/log/quick-add?meal=${meal}${dateSuffix}`} className="text-brand-700 underline">
          + Custom
        </Link>
        {!date && (
          <Link to={`/scan?meal=${meal}`} className="text-brand-700 underline">
            Scan barcode
          </Link>
        )}
        {entries.length > 0 && (
          <Link
            to={`/templates/new?meal=${meal}${dateSuffix}`}
            className="text-brand-700 underline"
            data-testid={`save-template-${meal}`}
          >
            Save as template
          </Link>
        )}
      </div>
    </section>
  )
}
