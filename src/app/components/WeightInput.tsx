import { useEffect, useState } from 'react'
import { kgToLb, lbToKg } from '../../domain/units/weight'
import SegmentedControl from './SegmentedControl'
import { TEXT_INPUT_CLASS } from './formStyles'

export type WeightUnit = 'kg' | 'lb'

const UNIT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
]

interface Props {
  /** Canonical value in kg, as a string (matches the plain <input> contract this replaces). */
  valueKg: string
  onChangeKg: (kg: string) => void
  unit: WeightUnit
  onUnitChange: (unit: WeightUnit) => void
}

/**
 * Drop-in replacement for a bare kg <input> — still reports/receives a plain
 * kg string via valueKg/onChangeKg. The displayed lb value is the source of
 * truth while the user edits in lb mode (re-derived from valueKg only on a
 * kg -> lb unit switch, not every keystroke), same pattern as HeightInput.
 */
export default function WeightInput({ valueKg, onChangeKg, unit, onUnitChange }: Props) {
  const [lbValue, setLbValue] = useState('')

  useEffect(() => {
    if (unit !== 'lb') return
    const kg = Number(valueKg)
    if (!Number.isFinite(kg) || kg <= 0) return
    setLbValue(String(kgToLb(kg)))
    // Only re-derive on a kg -> lb unit switch, not on every valueKg change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit])

  function handleLbChange(next: string) {
    setLbValue(next)
    const lbNum = Number(next)
    if (Number.isFinite(lbNum)) {
      onChangeKg(String(lbToKg(lbNum)))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label="Weight unit"
        options={UNIT_OPTIONS}
        value={unit}
        onChange={onUnitChange}
        testIdPrefix="weight-unit"
      />
      {unit === 'kg' ? (
        <input
          type="number"
          step="0.1"
          className={TEXT_INPUT_CLASS}
          value={valueKg}
          onChange={(e) => onChangeKg(e.target.value)}
          placeholder="kg"
          data-testid="weight-input-kg"
        />
      ) : (
        <input
          type="number"
          step="0.1"
          className={TEXT_INPUT_CLASS}
          value={lbValue}
          onChange={(e) => handleLbChange(e.target.value)}
          placeholder="lb"
          data-testid="weight-input-lb"
        />
      )}
    </div>
  )
}
