import { useEffect, useState } from 'react'
import { cmToFeetInches, feetInchesToCm } from '../../domain/units/length'
import SegmentedControl from './SegmentedControl'
import { TEXT_INPUT_CLASS } from './formStyles'

export type HeightUnit = 'cm' | 'ft_in'

const UNIT_OPTIONS: { value: HeightUnit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'ft_in', label: 'ft + in' },
]

interface Props {
  /** Canonical value in cm, as a string (matches the plain <input> contract this replaces). */
  valueCm: string
  onChangeCm: (cm: string) => void
  unit: HeightUnit
  onUnitChange: (unit: HeightUnit) => void
}

/**
 * Drop-in replacement for a bare cm <input> — still reports/receives a plain
 * cm string via valueCm/onChangeCm, so callers keep their existing
 * validation logic unchanged. When unit is 'ft_in', feet/inches become the
 * source of truth while the user edits (re-derived from valueCm only when
 * the unit is switched, not on every keystroke) to avoid the two fields
 * fighting over rounding during entry.
 */
export default function HeightInput({ valueCm, onChangeCm, unit, onUnitChange }: Props) {
  const [feet, setFeet] = useState('')
  const [inches, setInches] = useState('')

  useEffect(() => {
    if (unit !== 'ft_in') return
    const cm = Number(valueCm)
    if (!Number.isFinite(cm) || cm <= 0) return
    const parsed = cmToFeetInches(cm)
    setFeet(String(parsed.feet))
    setInches(String(parsed.inches))
    // Only re-derive on a cm -> ft_in unit switch, not on every valueCm change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit])

  function handleFeetInchesChange(nextFeet: string, nextInches: string) {
    setFeet(nextFeet)
    setInches(nextInches)
    const feetNum = Number(nextFeet)
    const inchesNum = Number(nextInches)
    if (Number.isFinite(feetNum) && Number.isFinite(inchesNum)) {
      onChangeCm(String(feetInchesToCm(feetNum, inchesNum)))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label="Height unit"
        options={UNIT_OPTIONS}
        value={unit}
        onChange={onUnitChange}
        testIdPrefix="height-unit"
      />
      {unit === 'cm' ? (
        <input
          type="number"
          className={TEXT_INPUT_CLASS}
          value={valueCm}
          onChange={(e) => onChangeCm(e.target.value)}
          placeholder="cm"
          data-testid="height-input-cm"
        />
      ) : (
        <div className="flex gap-2">
          <input
            type="number"
            className={`w-full ${TEXT_INPUT_CLASS}`}
            value={feet}
            onChange={(e) => handleFeetInchesChange(e.target.value, inches)}
            placeholder="feet"
            data-testid="height-input-feet"
          />
          <input
            type="number"
            className={`w-full ${TEXT_INPUT_CLASS}`}
            value={inches}
            onChange={(e) => handleFeetInchesChange(feet, e.target.value)}
            placeholder="inches"
            data-testid="height-input-inches"
          />
        </div>
      )}
    </div>
  )
}
