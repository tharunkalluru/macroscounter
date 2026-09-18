interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  testIdPrefix?: string
}

/** Pill-segmented radio group — same visual pattern as the Appearance (Light/Dark/System) toggle, generalized for reuse across profile forms. */
export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  testIdPrefix,
}: Props<T>) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</legend>
      <div className={`${options.length === 4 ? 'grid grid-cols-2 sm:grid-cols-4' : 'flex'} gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800`} role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            data-testid={testIdPrefix ? `${testIdPrefix}-${opt.value}` : undefined}
            onClick={() => onChange(opt.value)}
            className={`min-h-touch min-w-0 flex-1 break-words rounded-md px-2 text-sm font-medium transition-transform active:scale-[0.97] ${
              value === opt.value
                ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
