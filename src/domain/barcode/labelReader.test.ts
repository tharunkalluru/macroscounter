import { describe, expect, it, vi } from 'vitest'
import { getLabelReader, NullLabelReader, VisionApiLabelReader } from './labelReader'

describe('NullLabelReader', () => {
  it('always returns null, deferring to the manual entry form', async () => {
    const reader = new NullLabelReader()
    expect(await reader.readLabel(new Blob())).toBeNull()
  })
})

describe('VisionApiLabelReader', () => {
  it('parses a successful vision API response into a ParsedLabel', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Protein Bar', kcal: 380, p: 25, c: 40, f: 12 }),
    })
    const reader = new VisionApiLabelReader('https://vision.example/api', 'test-key', fetchImpl)

    const result = await reader.readLabel(new Blob())

    expect(result?.name).toBe('Protein Bar')
    expect(result?.per100g).toEqual({ kcal: 380, p: 25, c: 40, f: 12 })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://vision.example/api',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns null gracefully on a failed request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
    const reader = new VisionApiLabelReader('https://vision.example/api', 'test-key', fetchImpl)
    expect(await reader.readLabel(new Blob())).toBeNull()
  })

  it('returns null gracefully on a network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'))
    const reader = new VisionApiLabelReader('https://vision.example/api', 'test-key', fetchImpl)
    expect(await reader.readLabel(new Blob())).toBeNull()
  })
})

describe('getLabelReader', () => {
  it('returns a NullLabelReader when no vision API key/endpoint is configured', () => {
    expect(getLabelReader()).toBeInstanceOf(NullLabelReader)
  })
})
