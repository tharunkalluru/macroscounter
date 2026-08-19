import type { LogEntry } from '../../data/models'
import { computeMacroBreakdown } from '../../domain/logging/macroBreakdown'
import BottomSheet from '../shell/BottomSheet'

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

interface Props {
  open: boolean
  onClose: () => void
  macro: { key: 'p' | 'c' | 'f'; label: string; colorClass: string } | null
  entries: LogEntry[]
}

export default function MacroBreakdownSheet({ open, onClose, macro, entries }: Props) {
  const rows = macro ? computeMacroBreakdown(entries, macro.key) : []
  const total = rows.reduce((sum, r) => sum + r.grams, 0)

  return (
    <BottomSheet open={open} onClose={onClose} title={macro ? `${macro.label} by meal` : ''}>
      <ul className="divide-y divide-slate-100" data-testid="macro-breakdown-list">
        {rows.map((row) => (
          <li key={row.meal} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${macro?.colorClass ?? ''}`} aria-hidden="true" />
              <span>{MEAL_LABELS[row.meal]}</span>
            </div>
            <span className="tabular-nums text-slate-600">{row.grams} g</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-slate-200 py-3 font-semibold">
        <span>Total</span>
        <span className="tabular-nums" data-testid="macro-breakdown-total">
          {Math.round(total * 10) / 10} g
        </span>
      </div>
    </BottomSheet>
  )
}
