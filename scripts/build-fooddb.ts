import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Food } from '../src/domain/fooddb/types'
import { CURATED_FOODS } from './data/curatedFoods'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../public/fooddb.json')

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function buildFoodDb(): Food[] {
  const seenIds = new Set<string>()
  const foods: Food[] = CURATED_FOODS.map((raw) => {
    const id = slugify(raw.name)
    if (seenIds.has(id)) {
      throw new Error(`Duplicate food id generated: "${id}" from name "${raw.name}"`)
    }
    seenIds.add(id)

    if (raw.portions.length === 0) {
      throw new Error(`Food "${raw.name}" has no portions defined`)
    }

    const { p, c, f, fiber } = raw.macros
    const kcal = round1(p * 4 + c * 4 + f * 9)
    if (kcal <= 0) {
      throw new Error(`Food "${raw.name}" computed kcal <= 0`)
    }

    return {
      id,
      name: raw.name,
      aliases: raw.aliases ?? [],
      category: raw.category,
      per100g: { kcal, p: round1(p), c: round1(c), f: round1(f), fiber: round1(fiber) },
      portions: raw.portions,
      source: 'IFCT-2017-derived',
      verified: true,
    }
  })

  return foods
}

function main() {
  const foods = buildFoodDb()
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(foods, null, 2) + '\n', 'utf-8')
  console.log(`Wrote ${foods.length} foods to ${OUTPUT_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
