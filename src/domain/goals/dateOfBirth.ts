/**
 * Whole years between a date of birth and a reference date (ISO
 * yyyy-mm-dd), matching how "age" is colloquially meant — not yet a year
 * older until the birthday has actually passed this year.
 */
export function ageFromDateOfBirth(dateOfBirthISO: string, referenceDateISO: string): number {
  const [by, bm, bd] = dateOfBirthISO.split('-').map(Number)
  const [ry, rm, rd] = referenceDateISO.split('-').map(Number)

  let age = ry - by
  const birthdayPassedThisYear = rm > bm || (rm === bm && rd >= bd)
  if (!birthdayPassedThisYear) age -= 1

  return age
}
