/**
 * Option lists for the onboarding-only questions. These are additive
 * `Profile` fields with no engine effect except where noted — see
 * `goalEngine.ts`'s `proteinGPerKg`/`fatGPerKg`/`floorBufferKcal` inputs.
 * Every "default" value below is chosen so the wizard's initial selection
 * reproduces today's exact behavior (undefined/0) — only an explicit user
 * change alters the computed target.
 */

/**
 * Two separate real questions in the design (frame 4) rather than a single
 * generic tracking-experience question: whether they've ever weighed more,
 * and their 3-month trend direction. Both are onboarding-only context with
 * no engine effect — stored as one combined value since there's nowhere
 * else in `Profile` these need to live independently yet.
 */
export type WeighedMoreBefore = 'yes' | 'no' | 'not_sure'
export type RecentWeightTrend = 'falling' | 'rising' | 'stable' | 'not_sure'

export const WEIGHED_MORE_OPTIONS: { value: WeighedMoreBefore; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
]

export const RECENT_TREND_OPTIONS: { value: RecentWeightTrend; label: string }[] = [
  { value: 'falling', label: 'Slowly falling' },
  { value: 'rising', label: 'Rising' },
  { value: 'stable', label: 'Stable' },
  { value: 'not_sure', label: 'Not sure' },
]

// value is the body-fat % as a string (ChoiceGrid requires string values) —
// Number(value) when saving to Profile.bodyFatPercent. Nine buckets, a 3x3
// grid (frame 5) rather than five broader ones.
export const BODY_FAT_OPTIONS: { value: string; label: string }[] = [
  { value: '9', label: '8-10%' },
  { value: '11', label: '10-12%' },
  { value: '14', label: '12-15%' },
  { value: '17', label: '15-18%' },
  { value: '20', label: '18-22%' },
  { value: '25', label: '22-27%' },
  { value: '30', label: '27-32%' },
  { value: '35', label: '32-38%' },
  { value: '40', label: '38%+' },
]

export type DietStyle = 'balanced' | 'low_fat' | 'low_carb' | 'keto'

export const DIET_STYLE_OPTIONS: {
  value: DietStyle
  label: string
  description: string
  fatGPerKg?: number
}[] = [
  { value: 'balanced', label: 'Balanced', description: "Roti and rice stay in — today's default" },
  { value: 'low_fat', label: 'Low-fat', description: 'Less ghee & oil', fatGPerKg: 0.5 },
  { value: 'low_carb', label: 'Low-carb', description: 'Fewer grains', fatGPerKg: 1.1 },
  { value: 'keto', label: 'Keto', description: 'Under 30g carbs', fatGPerKg: 1.5 },
]

export type ProteinPriority = 'low' | 'moderate' | 'high' | 'extra_high'

export const PROTEIN_PRIORITY_OPTIONS: {
  value: ProteinPriority
  label: string
  proteinGPerKg?: number
}[] = [
  { value: 'low', label: 'Low', proteinGPerKg: 1.4 },
  { value: 'moderate', label: 'Mod' },
  { value: 'high', label: 'High', proteinGPerKg: 2.0 },
  { value: 'extra_high', label: 'Extra', proteinGPerKg: 2.2 },
]

export type CalorieFloorChoice = 'standard' | 'gentler' | 'low'

export const CALORIE_FLOOR_OPTIONS: {
  value: CalorieFloorChoice
  label: string
  description: string
  floorBufferKcal?: number
  /** Overrides the standard floor outright rather than buffering above it — see goalEngine's floorKcal input. */
  floorKcalOverride?: number
}[] = [
  { value: 'standard', label: 'Standard', description: "Bitewise's usual safety floor — never below 1,200" },
  { value: 'gentler', label: 'Gentler', description: '+150 kcal/day buffer above the floor', floorBufferKcal: 150 },
  {
    value: 'low',
    label: 'Low',
    description: 'Below 800 — medical supervision recommended',
    floorKcalOverride: 800,
  },
]
