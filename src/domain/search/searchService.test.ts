import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Food } from '../fooddb/types'
import { FoodSearchService } from './searchService'

let service: FoodSearchService

beforeAll(() => {
  const fooddbPath = resolve(__dirname, '../../../public/fooddb.json')
  const foods: Food[] = JSON.parse(readFileSync(fooddbPath, 'utf-8'))
  service = new FoodSearchService(foods)
})

describe('FoodSearchService', () => {
  it('finds dosa via the "dosai" alias', () => {
    const [top] = service.search('dosai')
    expect(top?.name).toBe('Plain Dosa')
  })

  it('finds sambar via the "sambhar" alias', () => {
    const [top] = service.search('sambhar')
    expect(top?.name).toBe('Sambar')
  })

  it('finds chicken biryani despite a typo', () => {
    const [top] = service.search('chiken biryani')
    expect(top?.name).toBe('Chicken Biryani')
  })

  it('returns no results for an empty query', () => {
    expect(service.search('')).toEqual([])
    expect(service.search('   ')).toEqual([])
  })

  describe('top-result relevance', () => {
    const cases: Array<[query: string, expectedName: string]> = [
      ['dosai', 'Plain Dosa'],
      ['sambhar', 'Sambar'],
      ['chiken biryani', 'Chicken Biryani'],
      ['idly', 'Idli'],
      ['curd rice', 'Curd Rice'],
      ['chappati', 'Chapati'],
      ['tomato chutny', 'Tomato Chutney'],
      ['grilled chicken', 'Grilled Chicken Breast'],
      ['fish fry', 'Fish Fry'],
      ['badam', 'Almonds'],
      ['thayir', 'Curd, Plain'],
      ['poori', 'Puri'],
      ['kaju', 'Cashews'],
      ['gulab jamu', 'Gulab Jamun'],
      ['filter coffee', 'Filter Coffee'],
    ]

    it.each(cases)('query "%s" ranks "%s" first', (query, expectedName) => {
      const [top] = service.search(query)
      expect(top?.name).toBe(expectedName)
    })
  })
})
