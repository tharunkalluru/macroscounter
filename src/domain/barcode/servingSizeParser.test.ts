import { describe, expect, it } from 'vitest'
import { parseServingSize } from './servingSizeParser'

describe('parseServingSize', () => {
  it.each([
    ['75 g', 75],
    ['75g', 75],
    ['10 g', 10],
    ['2 x 40g', 80],
    ['2 x 40 g', 80],
    ['3x25g', 75],
    ['250 ml', 250],
    ['1 x 250ml', 250],
    ['500 G', 500], // case-insensitive unit
    ['12.5 g', 12.5],
  ] as const)('parses %s -> %s g', (text, expected) => {
    expect(parseServingSize(text)).toBe(expected)
  })

  it.each([undefined, '', 'unknown', 'a pinch', 'net wt 1 lb'] as const)(
    'returns undefined for unparsable input %s',
    (text) => {
      expect(parseServingSize(text)).toBeUndefined()
    }
  )
})
