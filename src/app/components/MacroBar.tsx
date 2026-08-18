interface Props {
  label: string
  consumed: number
  target: number
  colorClass: string
  testId: string
}

export default function MacroBar({ label, consumed, target, colorClass, testId }: Props) {
  const pct = target > 0 ? Math.min(1, consumed / target) : 0

  return (
    <div data-testid={testId}>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span data-testid={`${testId}-value`}>
          {Math.round(consumed)} / {Math.round(target)} g
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}
