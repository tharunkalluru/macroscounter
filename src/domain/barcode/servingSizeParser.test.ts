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
    // Household-unit description with the gram/ml equivalent in
    // parentheses -- the most common real-world Open Food Facts format for
    // packaged snacks/drinks, and the reported gap: these were previously
    // unparsable, silently falling back to a raw-grams default instead of
    // the servings-first entry.
    ['1 bar (40g)', 40],
    ['2 biscuits (20 g)', 20],
    ['1 cup (240 ml)', 240],
    ['1 shake (33g)', 33],
    ['30g (1 biscuit)', 30], // leading value still wins over the parenthetical
  ] as const)('parses %s -> %s g', (text, expected) => {
    expect(parseServingSize(text)).toBe(expected)
  })

  it.each([undefined, '', 'unknown', 'a pinch', 'net wt 1 lb'] as const)(
    'returns undefined for unparsable input %s',
    (text) => {
      expect(parseServingSize(text)).toBeUndefined()
    }
  )

  it('parses spelled-out gram and millilitre units', () => {
    // Real OFF serving_size values are free text -- "40 grams" was
    // unparseable before, which silently dropped the scan into grams-first
    // mode with a meaningless 100 g default.
    expect(parseServingSize('40 grams')).toBe(40)
    expect(parseServingSize('40 gram')).toBe(40)
    expect(parseServingSize('30g')).toBe(30)
    expect(parseServingSize('250 millilitres')).toBe(250)
    expect(parseServingSize('250 milliliters')).toBe(250)
    expect(parseServingSize('1 bar (40 grams)')).toBe(40)
  })
})
