interface Props {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  testId?: string
}

/** Accessible on/off switch for independent boolean preferences (unlike SegmentedControl's mutually-exclusive radio group). */
export default function ToggleSwitch({ label, description, checked, onChange, testId }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className="flex min-h-touch w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
        {description && (
          <span className="block text-caption text-slate-500 dark:text-slate-400">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
