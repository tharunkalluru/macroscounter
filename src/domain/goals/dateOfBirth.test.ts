import { describe, expect, it } from 'vitest'
import { ageFromDateOfBirth } from './dateOfBirth'

describe('ageFromDateOfBirth', () => {
  it('counts a full year once the birthday has passed this year', () => {
    expect(ageFromDateOfBirth('1998-03-15', '2026-08-31')).toBe(28)
  })

  it('has not yet incremented when the birthday is still ahead this year', () => {
    expect(ageFromDateOfBirth('1998-12-15', '2026-08-31')).toBe(27)
  })

  it('turns a year older on the exact birthday', () => {
    expect(ageFromDateOfBirth('1998-08-31', '2026-08-31')).toBe(28)
  })

  it('is one day away from turning older the day before the birthday', () => {
    expect(ageFromDateOfBirth('1998-09-01', '2026-08-31')).toBe(27)
  })
})
