import { describe, expect, it } from 'vitest'
import amulButter from './fixtures/off-amul-butter.json'
import britanniaGoodDay from './fixtures/off-britannia-goodday.json'
import cola from './fixtures/off-cola-can.json'
import missingNutriments from './fixtures/off-missing-nutriments.json'
import multipackBiscuits from './fixtures/off-multipack-biscuits.json'
import notFound from './fixtures/off-not-found.json'
import { parseOFFResponse } from './offParser'

describe('parseOFFResponse', () => {
  it('parses a real-shaped Amul product response', () => {
    const result = parseOFFResponse('8901491101615', amulButter)
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Amul Butter')
    expect(result?.brand).toBe('Amul')
    expect(result?.per100g).toEqual({
      kcal: 717,
      p: 0.5,
      c: 0.1,
      f: 80,
      fiber: 0,
      sugar: undefined,
      saturatedFat: undefined,
      sodium: undefined,
    })
    expect(result?.perServing).toEqual({ kcal: 71.7, p: 0.05, c: 0.01, f: 8 })
    expect(result?.servingSize).toBe(10)
    expect(result?.quantity).toBe(500)
    expect(result?.source).toBe('off')
  })

  it('parses a real-shaped Britannia product response', () => {
    const result = parseOFFResponse('8901063114074', britanniaGoodDay)
    expect(result?.name).toBe('Good Day Cashew Cookies')
    expect(result?.brand).toBe('Britannia')
    expect(result?.per100g).toEqual({
      kcal: 502,
      p: 6.9,
      c: 64,
      f: 23,
      fiber: 1.5,
      sugar: undefined,
      saturatedFat: undefined,
      sodium: undefined,
    })
    expect(result?.servingSize).toBe(30)
  })

  it('parses a "2 x 40 g" multi-pack quantity into total grams, plus the image URL and extra nutriments', () => {
    const result = parseOFFResponse('8901030811234', multipackBiscuits)
    expect(result?.name).toBe('Parle-G Multipack Biscuits')
    expect(result?.imageUrl).toBe(
      'https://images.openfoodfacts.org/images/products/890/103/081/1234/front.jpg'
    )
    expect(result?.servingSize).toBe(40) // serving_size "40 g" (per-pack)
    expect(result?.servingSizeText).toBe('40 g')
    expect(result?.quantity).toBe(80) // quantity "2 x 40 g" -> 2 packs of 40g
    expect(result?.per100g).toMatchObject({ fiber: 2.1, sugar: 18, saturatedFat: 6.8, sodium: 0.35 })
  })

  it('parses a "250 ml" serving size (liquids, 1 ml ~= 1 g) into grams', () => {
    const result = parseOFFResponse('8901063212345', cola)
    expect(result?.servingSize).toBe(250)
    expect(result?.quantity).toBe(250)
  })

  it('returns null (graceful) for a response with empty nutriments instead of throwing', () => {
    expect(() => parseOFFResponse('8900000000017', missingNutriments)).not.toThrow()
    expect(parseOFFResponse('8900000000017', missingNutriments)).toBeNull()
  })

  it('returns null for a "product not found" response', () => {
    expect(parseOFFResponse('0000000000000', notFound)).toBeNull()
  })

  it('returns null for malformed/unexpected input rather than throwing', () => {
    expect(parseOFFResponse('123', null)).toBeNull()
    expect(parseOFFResponse('123', undefined)).toBeNull()
    expect(parseOFFResponse('123', 'not an object')).toBeNull()
    expect(parseOFFResponse('123', {})).toBeNull()
  })

  it("falls back to OFF's numeric serving_quantity when serving_size text is absent", () => {
    // Real shape (verified against the live OFF API for Nutella): no
    // `serving_size` at all, only the numeric/imported variants. Reading the
    // text field alone left servingSize undefined, so the scan dropped into
    // grams-first mode with a 100 g default and the user had to retype the
    // amount on every scan.
    const result = parseOFFResponse('3017620422003', {
      status: 1,
      product: {
        product_name: 'Nutella',
        nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
        serving_quantity: 15,
        serving_quantity_unit: 'g',
        quantity: '400 g e',
        product_quantity: 400,
        product_quantity_unit: 'g',
      },
    })
    expect(result?.servingSize).toBe(15)
    expect(result?.quantity).toBe(400)
  })

  it('falls back to serving_size_imported text when nothing else is parseable', () => {
    const result = parseOFFResponse('123', {
      status: 1,
      product: {
        product_name: 'Imported only',
        nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 },
        serving_size_imported: '15 g (15)',
      },
    })
    expect(result?.servingSize).toBe(15)
    expect(result?.servingSizeText).toBe('15 g (15)')
  })

  it('uses product_quantity when the quantity text is unparseable', () => {
    const result = parseOFFResponse('123', {
      status: 1,
      product: {
        product_name: 'Odd quantity text',
        nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 },
        quantity: 'one large jar',
        product_quantity: 750,
        product_quantity_unit: 'g',
      },
    })
    expect(result?.quantity).toBe(750)
  })

  it('ignores numeric serving fields carrying a non gram/ml unit', () => {
    const result = parseOFFResponse('123', {
      status: 1,
      product: {
        product_name: 'Ounces',
        nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 },
        serving_quantity: 2,
        serving_quantity_unit: 'oz',
      },
    })
    expect(result?.servingSize).toBeUndefined()
  })
})
