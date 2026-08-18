import type { LabelReader, ParsedLabel } from './types'

/** Used when no vision API is configured — always defers to the manual entry form. */
export class NullLabelReader implements LabelReader {
  async readLabel(_image: Blob): Promise<ParsedLabel | null> {
    return null
  }
}

/** Sends the nutrition-label photo to a configured vision API and parses its response. */
export class VisionApiLabelReader implements LabelReader {
  constructor(
    private endpoint: string,
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch
  ) {}

  async readLabel(image: Blob): Promise<ParsedLabel | null> {
    try {
      const form = new FormData()
      form.append('image', image)

      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      })
      if (!res.ok) return null

      const json = (await res.json()) as { name?: string; kcal?: number; p?: number; c?: number; f?: number }
      return {
        name: json.name,
        per100g: { kcal: json.kcal, p: json.p, c: json.c, f: json.f },
      }
    } catch {
      return null
    }
  }
}

export function getLabelReader(): LabelReader {
  const endpoint = import.meta.env.VITE_LABEL_READER_ENDPOINT
  const apiKey = import.meta.env.VITE_LABEL_READER_API_KEY
  if (endpoint && apiKey) {
    return new VisionApiLabelReader(endpoint, apiKey)
  }
  return new NullLabelReader()
}
