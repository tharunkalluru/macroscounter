export interface Portion {
  label: string
  grams: number
}

export interface MacrosPer100g {
  kcal: number
  p: number
  c: number
  f: number
  fiber: number
}

export type FoodCategory =
  | 'south-indian'
  | 'rice-grains'
  | 'breads'
  | 'dals-legumes'
  | 'vegetables-curries'
  | 'chicken'
  | 'fish-seafood'
  | 'mutton'
  | 'eggs'
  | 'snacks'
  | 'sweets'
  | 'beverages'
  | 'dairy-basics'
  | 'fruits'
  | 'nuts-seeds'
  | 'general'

export interface Food {
  id: string
  name: string
  aliases: string[]
  category: FoodCategory
  per100g: MacrosPer100g
  portions: Portion[]
  source: string
  verified: boolean
}
