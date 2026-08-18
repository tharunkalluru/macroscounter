import type { Per100g } from './portionMath'

export interface RecipeIngredientInput {
  foodId: string
  grams: number
}

export interface RecipeComputation {
  computedPer100g: Per100g
  totalGrams: number
  gramsPerServing: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function sumIngredientGrams(ingredients: RecipeIngredientInput[]): number {
  return ingredients.reduce((sum, ingredient) => sum + ingredient.grams, 0)
}

/**
 * Combine ingredients (each with its own per-100g profile and grams used) into
 * a single per-100g profile for the whole recipe, plus grams-per-serving.
 */
export function computeRecipe(
  ingredients: RecipeIngredientInput[],
  foodsById: Map<string, Per100g>,
  servings: number
): RecipeComputation {
  if (ingredients.length === 0) {
    throw new Error('Recipe must have at least one ingredient')
  }
  if (servings <= 0) {
    throw new Error('Recipe must have at least one serving')
  }

  let totalGrams = 0
  let totalKcal = 0
  let totalP = 0
  let totalC = 0
  let totalF = 0

  for (const ingredient of ingredients) {
    const per100g = foodsById.get(ingredient.foodId)
    if (!per100g) {
      throw new Error(`Unknown ingredient food id: ${ingredient.foodId}`)
    }
    const factor = ingredient.grams / 100
    totalGrams += ingredient.grams
    totalKcal += per100g.kcal * factor
    totalP += per100g.p * factor
    totalC += per100g.c * factor
    totalF += per100g.f * factor
  }

  const scaleTo100g = 100 / totalGrams
  return {
    computedPer100g: {
      kcal: round1(totalKcal * scaleTo100g),
      p: round1(totalP * scaleTo100g),
      c: round1(totalC * scaleTo100g),
      f: round1(totalF * scaleTo100g),
    },
    totalGrams,
    gramsPerServing: round1(totalGrams / servings),
  }
}
