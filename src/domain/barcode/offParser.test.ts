import { describe, expect, it } from 'vitest'
import amulButter from './fixtures/off-amul-butter.json'
import britanniaGoodDay from './fixtures/off-britannia-goodday.json'
import missingNutriments from './fixtures/off-missing-nutriments.json'
import notFound from './fixtures/off-not-found.json'
import { parseOFFResponse } from './offParser'

describe('parseOFFResponse', () => {
  it('parses a real-shaped Amul product response', () => {
    const result = parseOFFResponse('8901491101615', amulButter)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Amul Butter')
    expect(result?.brand).toBe('Amul')
    expect(result?.per100g).toEqual({ kcal: 717, p: 0.5, c: 0.1, f: 80 })
    expect(result?.perServing).toEqual({ kcal: 71.7, p: 0.05, c: 0.01, f: 8 })
    expect(result?.servingSize).toBe(10)
    expect(result?.quantity).toBe(500)
    expect(result?.source).toBe('off')
  })

  it('parses a real-shaped Britannia product response', () => {
    const result = parseOFFResponse('8901063114074', britanniaGoodDay)
    expect(result?.name).toBe('Good Day Cashew Cookies')
    expect(result?.brand).toBe('Britannia')
    expect(result?.per100g).toEqual({ kcal: 502, p: 6.9, c: 64, f: 23 })
    expect(result?.servingSize).toBe(30)
  })

  it('returns null (graceful) for a response with empty nutriments instead of throwing', () => {
    expect(() => parseOFFResponse('8900000000017', missingNutriments)).not.toThrow()
    expect(parseOFFResponse('8900000000017', missingNutriments)).toBeNull()
  })

  it('returns null for a "product not found" response', () => {
    expect(parseOFFResponse('0000000000000', notFound)).toBeNull()
  })

  it('returns null for malformed/unexpected input rather than throwing', () => {
    expect(parseOFFResponse('123', null)).toBeNull()
    expect(parseOFFResponse('123', undefined)).toBeNull()
    expect(parseOFFResponse('123', 'not an object')).toBeNull()
    expect(parseOFFResponse('123', {})).toBeNull()
  })
})
