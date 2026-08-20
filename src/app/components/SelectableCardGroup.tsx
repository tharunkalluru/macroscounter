interface Option<T extends string> {
  value: T
  label: string
  description?: string
}

interface Props<T extends string> {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  testIdPrefix?: string
}

/** Vertical list of tappable, radio-style cards — richer and easier to scan on mobile than a native `<select>`, used for options with a short description (activity level, goal). */
export default function SelectableCardGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  testIdPrefix,
}: Props<T>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</legend>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const checked = value === opt.value
          const descriptionId = testIdPrefix ? `${testIdPrefix}-${opt.value}-description` : undefined
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={opt.label}
              aria-describedby={opt.description ? descriptionId : undefined}
              data-testid={testIdPrefix ? `${testIdPrefix}-${opt.value}` : undefined}
              onClick={() => onChange(opt.value)}
              className={`flex min-h-touch items-center justify-between gap-3 rounded-card border px-4 py-3 text-left transition-transform active:scale-[0.98] ${
                checked
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-slate-800'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-surface-dark-card'
              }`}
            >
              <span className="min-w-0">
                <span className="block font-medium text-slate-900 dark:text-slate-100">{opt.label}</span>
                {opt.description && (
                  <span id={descriptionId} className="block text-caption text-slate-500 dark:text-slate-400">
                    {opt.description}
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  checked ? 'border-brand-600 dark:border-brand-400' : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
