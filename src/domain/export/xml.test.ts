import { describe, expect, it } from 'vitest'
import { buildFullExportXML, serializeXmlValue } from './xml'

describe('serializeXmlValue', () => {
  it('escapes reserved XML characters in text', () => {
    expect(serializeXmlValue('name', 'Rice & "Dal" <spicy>')).toBe('<name>Rice &amp; "Dal" &lt;spicy&gt;</name>')
  })

  it('serializes numbers and booleans without quoting', () => {
    expect(serializeXmlValue('kcal', 240)).toBe('<kcal>240</kcal>')
    expect(serializeXmlValue('verified', true)).toBe('<verified>true</verified>')
  })

  it('renders null/undefined as a self-closing tag', () => {
    expect(serializeXmlValue('barcode', null)).toBe('<barcode/>')
    expect(serializeXmlValue('barcode', undefined)).toBe('<barcode/>')
  })

  it('recurses into nested objects', () => {
    expect(serializeXmlValue('customSnapshot', { name: 'Dal', kcal: 120 })).toBe(
      '<customSnapshot><name>Dal</name><kcal>120</kcal></customSnapshot>'
    )
  })

  it('serializes arrays as repeated item elements', () => {
    expect(serializeXmlValue('ingredients', [{ foodId: 'rice', grams: 100 }, { foodId: 'dal', grams: 50 }])).toBe(
      '<ingredients><item><foodId>rice</foodId><grams>100</grams></item><item><foodId>dal</foodId><grams>50</grams></item></ingredients>'
    )
  })

  it('renders an empty array the same as absent', () => {
    expect(serializeXmlValue('aliases', [])).toBe('<aliases/>')
  })
})

describe('buildFullExportXML', () => {
  it('produces a well-formed document containing every section, even when empty', () => {
    const xml = buildFullExportXML({
      profile: undefined,
      targets: [],
      logEntries: [],
      weighIns: [],
      recipes: [],
      mealTemplates: [],
      scannedProducts: [],
      now: new Date('2026-09-09T00:00:00.000Z'),
    })
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<bitewiseExport version="1" generatedAt="2026-09-09T00:00:00.000Z">')
    expect(xml).toContain('<profile/>')
    expect(xml).toContain('<targets></targets>')
    expect(xml).toContain('<logEntries></logEntries>')
    expect(xml).toContain('</bitewiseExport>')
  })

  it('includes real logged data with nested fields intact', () => {
    const xml = buildFullExportXML({
      profile: { name: 'Tharun', sex: 'male', age: 30, heightCm: 175, weightKg: 78, activityLevel: 'moderate', goal: 'cut' },
      targets: [],
      logEntries: [
        {
          date: '2026-09-08',
          meal: 'breakfast',
          name: 'Idli',
          portionSummary: '2 x 1 idli',
          qty: 2,
          unit: 'portion',
          grams: 80,
          kcal: 82,
          p: 3.6,
          c: 16,
          f: 0.4,
        },
      ],
      weighIns: [],
      recipes: [],
      mealTemplates: [],
      scannedProducts: [],
    })
    expect(xml).toContain('<name>Tharun</name>')
    expect(xml).toContain('<name>Idli</name>')
    expect(xml).toContain('<kcal>82</kcal>')
  })
})
