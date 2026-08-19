import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { FoodRecord } from '../data/models'
import { RecipeRepo } from '../data/repos/RecipeRepo'
import { computeRecipe, type RecipeIngredientInput } from '../domain/logging/recipeMath'
import { useFoodIndex } from './hooks/useFoodIndex'

interface DraftIngredient {
  food: FoodRecord
  grams: number
}

export default function RecipeBuilderPage() {
  const navigate = useNavigate()
  const { foods, service, loading } = useFoodIndex()

  const [name, setName] = useState('')
  const [servings, setServings] = useState('1')
  const [query, setQuery] = useState('')
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([])
  const [error, setError] = useState<string | null>(null)

  const results = useMemo(() => {
    if (!service || !query.trim()) return []
    return service.search(query, 10)
  }, [service, query])

  const foodsById = useMemo(() => {
    const map = new Map<string, FoodRecord['per100g']>()
    for (const f of foods ?? []) map.set(f.id, f.per100g)
    return map
  }, [foods])

  const preview = useMemo(() => {
    if (ingredients.length === 0) return null
    const servingsNum = Number(servings) || 1
    const input: RecipeIngredientInput[] = ingredients.map((i) => ({
      foodId: i.food.id,
      grams: i.grams,
    }))
    try {
      return computeRecipe(input, foodsById, servingsNum)
    } catch {
      return null
    }
  }, [ingredients, servings, foodsById])

  function addIngredient(food: FoodRecord) {
    setIngredients((prev) => [...prev, { food, grams: food.portions[0]?.grams ?? 100 }])
    setQuery('')
  }

  function updateGrams(index: number, grams: number) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, grams } : ing)))
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) return setError('Please name your recipe.')
    if (ingredients.length === 0) return setError('Add at least one ingredient.')
    const servingsNum = Number(servings)
    if (!Number.isFinite(servingsNum) || servingsNum <= 0)
      return setError('Servings must be at least 1.')
    if (!preview) return setError('Could not compute this recipe.')

    await new RecipeRepo().add({
      name: name.trim(),
      ingredients: ingredients.map((i) => ({ foodId: i.food.id, grams: i.grams })),
      servings: servingsNum,
      computedPer100g: preview.computedPer100g,
    })
    navigate('/')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link
        to="/"
        className="mb-4 inline-block text-sm text-brand-700 dark:text-brand-400 underline"
      >
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700 dark:text-brand-400">New recipe</h1>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Recipe name</span>
        <input
          className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-sm font-medium">Servings</span>
        <input
          type="number"
          min="1"
          className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
          value={servings}
          onChange={(e) => setServings(e.target.value)}
        />
      </label>

      <div className="mt-4">
        <p className="mb-1 text-sm font-medium">Ingredients</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700 rounded-lg bg-white dark:bg-surface-dark-card shadow-sm">
          {ingredients.map((ing, i) => (
            <li key={`${ing.food.id}-${i}`} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 truncate text-sm">{ing.food.name}</span>
              <input
                type="number"
                min="0"
                className="w-20 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-sm"
                value={ing.grams}
                onChange={(e) => updateGrams(i, Number(e.target.value))}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">g</span>
              <button
                type="button"
                className="text-xs text-red-600 dark:text-red-400 underline"
                onClick={() => removeIngredient(i)}
              >
                Remove
              </button>
            </li>
          ))}
          {ingredients.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              No ingredients yet.
            </li>
          )}
        </ul>

        <input
          type="text"
          placeholder="Search foods to add…"
          className="mt-2 w-full rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() && (
          <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-700 rounded-lg bg-white dark:bg-surface-dark-card shadow-sm">
            {results.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => addIngredient(food as FoodRecord)}
                >
                  {food.name}
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches.</li>
            )}
          </ul>
        )}
      </div>

      {preview && (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300" data-testid="recipe-preview">
          Per serving ({preview.gramsPerServing} g):{' '}
          {Math.round((preview.computedPer100g.kcal * preview.gramsPerServing) / 100)} kcal
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        className="mt-4 w-full rounded bg-brand-700 px-4 py-2 font-medium text-white"
      >
        Save recipe
      </button>
    </div>
  )
}
