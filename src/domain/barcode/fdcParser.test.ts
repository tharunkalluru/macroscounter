import { describe, expect, it } from 'vitest'
import fdcEmpty from './fixtures/fdc-search-empty.json'
import fdcBranded from './fixtures/fdc-search-branded.json'
import { parseFDCResponse } from './fdcParser'

describe('parseFDCResponse', () => {
  it('parses a branded-food search response matching by gtinUpc', () => {
    const result = parseFDCResponse('0012345678905', fdcBranded)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('CHOCOLATE CHIP COOKIES')
    expect(result?.brand).toBe('GENERIC BRAND FOODS')
    expect(result?.per100g).toEqual({ kcal: 480, p: 6.7, c: 63.3, f: 20, fiber: 3.3 })
    expect(result?.servingSize).toBe(30)
    expect(result?.source).toBe('fdc')
  })

  it('matches even when the scanned barcode has a leading zero the gtinUpc omits (or vice versa)', () => {
    const result = parseFDCResponse('12345678905', fdcBranded)
    expect(result?.name).toBe('CHOCOLATE CHIP COOKIES')
  })

  it('returns null for an empty search result', () => {
    expect(parseFDCResponse('0000000000000', fdcEmpty)).toBeNull()
  })

  it('returns null for malformed input rather than throwing', () => {
    expect(() => parseFDCResponse('123', null)).not.toThrow()
    expect(parseFDCResponse('123', null)).toBeNull()
    expect(parseFDCResponse('123', {})).toBeNull()
  })
})
