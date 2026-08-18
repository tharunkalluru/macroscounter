import { describe, expect, it } from 'vitest'
import { classifyDay } from './colorBand'

describe('classifyDay', () => {
  const target = 2000

  it.each([
    [undefined, target, 'none'],
    [1800, undefined, 'none'],
    [1500, 0, 'none'],
    [0, target, 'green'],
    [1800, target, 'green'],
    [2000, target, 'green'], // exactly at target -> green
    [2001, target, 'amber'], // just over -> amber
    [2100, target, 'amber'],
    [2200, target, 'amber'], // exactly 110% -> amber
    [2201, target, 'red'], // just over 110% -> red
    [3000, target, 'red'],
  ] as const)('classifyDay(%s, %s) -> %s', (consumed, tgt, expected) => {
    expect(classifyDay(consumed, tgt)).toBe(expected)
  })
})
