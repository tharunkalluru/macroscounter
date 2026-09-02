interface Option<T extends string> {
  value: T
  label: string
  description?: string
}

interface Props<T extends string> {
  legend: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  columns?: 2 | 3 | 4
  testIdPrefix?: string
}

/**
 * Grid of tappable choice cells — selection shown via border + text color,
 * no radio dot. This is the Nocturne redesign's grid/pill-row pattern for
 * onboarding questions (sex, body-fat, activity, diet-style/protein), used
 * alongside `SelectableCardGroup` (which stays the right shape for a plain
 * vertical list, e.g. calorie floor).
 */
export default function ChoiceGrid<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 2,
  testIdPrefix,
}: Props<T>) {
  const colsClass = columns === 4 ? 'grid-cols-4' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{legend}</legend>
      <div className={`grid ${colsClass} gap-2`} role="radiogroup" aria-label={legend}>
        {options.map((opt) => {
          const checked = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={opt.label}
              data-testid={testIdPrefix ? `${testIdPrefix}-${opt.value}` : undefined}
              onClick={() => onChange(opt.value)}
              className={`flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-card border px-2 py-3 text-center transition-transform active:scale-[0.97] ${
                checked
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-slate-800'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface-dark-card'
              }`}
            >
              <span
                className={`text-sm font-medium ${checked ? 'text-brand-700 dark:text-brand-400' : 'text-slate-900 dark:text-slate-100'}`}
              >
                {opt.label}
              </span>
              {opt.description && (
                <span
                  className={`text-caption ${checked ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {opt.description}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
