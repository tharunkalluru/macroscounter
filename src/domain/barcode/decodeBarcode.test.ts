import { describe, expect, it } from 'vitest'
import { decodeBarcodeFromLuminance } from './decodeBarcode'
import { ean13CheckDigit, renderEAN13 } from './ean13TestFixture'

describe('decodeBarcodeFromLuminance', () => {
  it('decodes a rendered EAN-13 fixture image back to the original code (Amul-style barcode)', () => {
    const code = '8901491101615'
    const { luminances, width, height } = renderEAN13(code)
    expect(decodeBarcodeFromLuminance(luminances, width, height)).toBe(code)
  })

  it('decodes a second, independently-generated EAN-13 fixture (Britannia-style barcode)', () => {
    const code = '8901063114074'
    const { luminances, width, height } = renderEAN13(code)
    expect(decodeBarcodeFromLuminance(luminances, width, height)).toBe(code)
  })

  it('decodes correctly across different bar widths and image heights', () => {
    const code = '4006381333931' // well-known reference EAN-13 test code
    const { luminances, width, height } = renderEAN13(code, 3, 120, 16)
    expect(decodeBarcodeFromLuminance(luminances, width, height)).toBe(code)
  })

  it('returns null (not throws) for a blank image with no barcode', () => {
    const width = 200
    const height = 100
    const blank = new Uint8ClampedArray(width * height).fill(255)
    expect(decodeBarcodeFromLuminance(blank, width, height)).toBeNull()
  })

  it('returns null for random noise', () => {
    const width = 200
    const height = 100
    const noise = new Uint8ClampedArray(width * height)
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() > 0.5 ? 0 : 255
    expect(decodeBarcodeFromLuminance(noise, width, height)).toBeNull()
  })
})

describe('ean13CheckDigit (fixture-generator self-check)', () => {
  it('computes the correct check digit for the well-known reference code 400638133393-1', () => {
    expect(ean13CheckDigit('400638133393')).toBe(1)
  })
})
