/**
 * Test-only EAN-13 fixture generator. @zxing/library's bundled writer only
 * supports QR/DataMatrix/Aztec (its 1D writers are commented out of the
 * build), so there's no library-provided way to synthesize a barcode image
 * fixture. This implements the standard EAN-13 symbology directly (start/
 * middle/end guards + L/G/R digit encodings) to render a real, decodable
 * barcode image for `decodeBarcode.test.ts` to exercise the ZXing reader
 * against. Not used by any production code path.
 */

const L_CODES = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
]
const G_CODES = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
]
const R_CODES = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
]
const FIRST_DIGIT_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
]

export function ean13CheckDigit(twelveDigits: string): number {
  const digits = twelveDigits.split('').map(Number)
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

function encodeEAN13Bits(code: string): string {
  if (code.length !== 13) throw new Error('EAN-13 needs exactly 13 digits')
  const digits = code.split('').map(Number)
  const parity = FIRST_DIGIT_PARITY[digits[0]]
  const left = digits.slice(1, 7)
  const right = digits.slice(7, 13)

  let bits = '101'
  for (let i = 0; i < 6; i++) {
    bits += parity[i] === 'L' ? L_CODES[left[i]] : G_CODES[left[i]]
  }
  bits += '01010'
  for (let i = 0; i < 6; i++) {
    bits += R_CODES[right[i]]
  }
  bits += '101'
  return bits
}

export interface RenderedBarcode {
  luminances: Uint8ClampedArray
  width: number
  height: number
}

/** Renders an EAN-13 barcode into an RGB-luminance-style buffer (0 = black, 255 = white). */
export function renderEAN13(code: string, barWidth = 2, height = 60, quietZone = 10): RenderedBarcode {
  const bits = encodeEAN13Bits(code)
  const width = bits.length * barWidth + quietZone * 2
  const luminances = new Uint8ClampedArray(width * height)
  luminances.fill(255)

  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue
    for (let bw = 0; bw < barWidth; bw++) {
      const x = quietZone + i * barWidth + bw
      for (let y = 0; y < height; y++) {
        luminances[y * width + x] = 0
      }
    }
  }

  return { luminances, width, height }
}
