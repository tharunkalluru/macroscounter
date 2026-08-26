const CM_PER_INCH = 2.54
const INCHES_PER_FOOT = 12

export interface FeetInches {
  feet: number
  inches: number
}

/** Converts cm to whole feet + rounded-to-nearest-inch, e.g. 175 -> { feet: 5, inches: 9 }. */
export function cmToFeetInches(cm: number): FeetInches {
  const totalInches = Math.round(cm / CM_PER_INCH)
  const feet = Math.floor(totalInches / INCHES_PER_FOOT)
  const inches = totalInches - feet * INCHES_PER_FOOT
  return { feet, inches }
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * INCHES_PER_FOOT + inches
  return Math.round(totalInches * CM_PER_INCH * 10) / 10
}
