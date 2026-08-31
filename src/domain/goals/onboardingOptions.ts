/**
 * Option lists for the Phase R.2 onboarding-only questions. These are new,
 * additive `Profile` fields with no engine effect except where noted —
 * see `goalEngine.ts`'s `proteinGPerKg`/`fatGPerKg`/`floorBufferKcal`
 * inputs. Every "default" value below is chosen so the wizard's initial
 * selection reproduces today's exact behavior (undefined/0) — only an
 * explicit user change alters the computed target.
 */

export type WeightHistoryClass = 'first_time' | 'some_success' | 'yo_yo' | 'long_term_maintainer'

export const WEIGHT_HISTORY_OPTIONS: { value: WeightHistoryClass; label: string; description?: string }[] = [
  { value: 'first_time', label: 'This is my first time tracking' },
  { value: 'some_success', label: "I've had some success with tracking before" },
  { value: 'yo_yo', label: "I've lost weight before but regained it" },
  { value: 'long_term_maintainer', label: "I've successfully maintained a goal before" },
]

// value is the body-fat % as a string (SelectableCardGroup requires string
// values) — Number(value) when saving to Profile.bodyFatPercent.
export const BODY_FAT_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: '12', label: 'Lean', description: 'Visible muscle definition' },
  { value: '18', label: 'Athletic', description: 'Some muscle definition' },
  { value: '25', label: 'Average', description: 'Little muscle definition' },
  { value: '32', label: 'Above average', description: 'Some excess body fat' },
  { value: '40', label: 'High', description: 'Notable excess body fat' },
]

export type DietStyle = 'balanced' | 'higher_fat' | 'lower_carb'

export const DIET_STYLE_OPTIONS: {
  value: DietStyle
  label: string
  description: string
  fatGPerKg?: number
}[] = [
  { value: 'balanced', label: 'Balanced', description: 'Moderate fat, carb-forward — today\'s default' },
  { value: 'higher_fat', label: 'Higher fat', description: 'More fat, moderately fewer carbs', fatGPerKg: 1.0 },
  { value: 'lower_carb', label: 'Lower carb', description: 'Most of your energy from fat and protein', fatGPerKg: 1.3 },
]

export type ProteinPriority = 'standard' | 'high' | 'very_high'

export const PROTEIN_PRIORITY_OPTIONS: {
  value: ProteinPriority
  label: string
  description: string
  proteinGPerKg?: number
}[] = [
  { value: 'standard', label: 'Standard', description: '1.8g per kg bodyweight' },
  { value: 'high', label: 'High', description: '2.0g per kg bodyweight', proteinGPerKg: 2.0 },
  { value: 'very_high', label: 'Very high', description: '2.2g per kg bodyweight', proteinGPerKg: 2.2 },
]

export type CalorieFloorChoice = 'standard' | 'gentler'

export const CALORIE_FLOOR_OPTIONS: {
  value: CalorieFloorChoice
  label: string
  description: string
  floorBufferKcal?: number
}[] = [
  { value: 'standard', label: 'Standard', description: "MacroDesi's usual safety floor" },
  { value: 'gentler', label: 'Gentler', description: '+150 kcal/day buffer above the floor', floorBufferKcal: 150 },
]
