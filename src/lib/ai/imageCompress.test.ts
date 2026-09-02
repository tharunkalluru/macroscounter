import { describe, expect, it } from 'vitest'
import { computeTargetDimensions, stripDataUrlPrefix } from './imageCompress'

describe('computeTargetDimensions', () => {
  it('leaves an image already under the cap unchanged', () => {
    expect(computeTargetDimensions(800, 600, 1568)).toEqual({ width: 800, height: 600 })
  })

  it('downscales a landscape image so the longest edge hits the cap', () => {
    expect(computeTargetDimensions(4000, 3000, 1568)).toEqual({ width: 1568, height: 1176 })
  })

  it('downscales a portrait image so the longest edge hits the cap', () => {
    expect(computeTargetDimensions(3000, 4000, 1568)).toEqual({ width: 1176, height: 1568 })
  })

  it('leaves a square image exactly at the cap unchanged', () => {
    expect(computeTargetDimensions(1568, 1568, 1568)).toEqual({ width: 1568, height: 1568 })
  })
})

describe('stripDataUrlPrefix', () => {
  it('removes the data-URL header, leaving only the base64 payload', () => {
    expect(stripDataUrlPrefix('data:image/jpeg;base64,aGVsbG8=')).toBe('aGVsbG8=')
  })

  it('returns the input unchanged if there is no comma', () => {
    expect(stripDataUrlPrefix('aGVsbG8=')).toBe('aGVsbG8=')
  })
})
