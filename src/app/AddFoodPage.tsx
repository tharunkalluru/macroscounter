import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { FoodRecord, Meal, Recipe } from '../data/models'
import type { Portion } from '../domain/fooddb/types'
import { FoodRepo } from '../data/repos/FoodRepo'
import { LogRepo } from '../data/repos/LogRepo'
import { RecipeRepo } from '../data/repos/RecipeRepo'
import { computeMacrosForGrams, gramsForPortion } from '../domain/logging/portionMath'
import { sumIngredientGrams } from '../domain/logging/recipeMath'
import { isFutureDate, todayISO } from '../lib/date'
import { useFoodIndex } from './hooks/useFoodIndex'

type Selected = { kind: 'food'; food: FoodRecord } | { kind: 'recipe'; recipe: Recipe }

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

function per100gOf(selected: Selected) {
  return selected.kind === 'food' ? selected.food.per100g : selected.recipe.computedPer100g
}

function nameOf(selected: Selected) {
  return selected.kind === 'food' ? selected.food.name : selected.recipe.name
}

function portionsOf(selected: Selected): Portion[] {
  if (selected.kind === 'food') return selected.food.portions
  const totalGrams = sumIngredientGrams(selected.recipe.ingredients)
  const perServing = Math.round((totalGrams / selected.recipe.servings) * 10) / 10
  return [{ label: '1 serving', grams: perServing }]
}

export default function AddFoodPage() {
  const [searchParams] = useSearchParams()
  const { entryId } = useParams()
  const navigate = useNavigate()
  const { foods, service, loading } = useFoodIndex()

  const [meal, setMeal] = useState<Meal>((searchParams.get('meal') as Meal) || 'breakfast')
  const requestedDate = searchParams.get('date')
  const [entryDate, setEntryDate] = useState(
    requestedDate && !isFutureDate(requestedDate) ? requestedDate : todayISO()
  )
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<FoodRecord[]>([])
  const [favorites, setFavorites] = useState<FoodRecord[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [portionIndex, setPortionIndex] = useState(0)
  const [mode, setMode] = useState<'portion' | 'grams'>('portion')
  const [qty, setQty] = useState('1')
  const [gramsValue, setGramsValue] = useState('100')
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      const logRepo = new LogRepo()
      const foodRepo = new FoodRepo()
      const recentIds = await logRepo.getRecentFoodIds(30)
      const [recentFoods, favoriteFoods, allRecipes] = await Promise.all([
        foodRepo.getByIds(recentIds),
        foodRepo.listFavorites(),
        new RecipeRepo().listAll(),
      ])
      setRecents(recentFoods)
      setFavorites(favoriteFoods)
      setRecipes(allRecipes)
    })()
  }, [])

  useEffect(() => {
    if (!entryId) return
    ;(async () => {
      const entry = await new LogRepo().getById(Number(entryId))
      if (!entry) return
      setEditingId(entry.id ?? null)
      setMeal(entry.meal)
      setEntryDate(entry.date)

      if (entry.foodId) {
        const food = await new FoodRepo().getById(entry.foodId)
        if (food) setSelected({ kind: 'food', food })
      } else if (entry.recipeId) {
        const recipe = await new RecipeRepo().getById(entry.recipeId)
        if (recipe) setSelected({ kind: 'recipe', recipe })
      }

      if (entry.unit === 'grams') {
        setMode('grams')
        setGramsValue(String(entry.grams))
      } else {
        setMode('portion')
        setQty(String(entry.qty))
      }
    })()
  }, [entryId])

  const results = useMemo(() => {
    if (!service || !query.trim()) return []
    return service.search(query, 20)
  }, [service, query])

  const portions = selected ? portionsOf(selected) : []

  useEffect(() => {
    setPortionIndex(0)
  }, [selected])

  const grams =
    mode === 'grams'
      ? Number(gramsValue) || 0
      : portions[portionIndex]
        ? gramsForPortion(Number(qty) || 0, portions[portionIndex].grams)
        : 0

  const preview = selected && grams > 0 ? computeMacrosForGrams(per100gOf(selected), grams) : null

  async function handleSave() {
    if (!selected || !preview || grams <= 0) return

    const portionSummary =
      mode === 'grams' ? `${grams} g` : `${qty} x ${portions[portionIndex].label}`

    const entryData = {
      date: entryDate,
      meal,
      foodId: selected.kind === 'food' ? selected.food.id : undefined,
      recipeId: selected.kind === 'recipe' ? selected.recipe.id : undefined,
      name: nameOf(selected),
      portionSummary,
      qty: mode === 'grams' ? grams : Number(qty) || 0,
      unit: mode,
      grams,
      kcal: preview.kcal,
      p: preview.p,
      c: preview.c,
      f: preview.f,
    }

    const logRepo = new LogRepo()
    if (editingId !== null) {
      await logRepo.updateEntry(editingId, entryData)
    } else {
      await logRepo.addEntry(entryData)
    }
    navigate(backTo)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  const backTo = entryDate === todayISO() ? '/' : `/history/${entryDate}`

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to={backTo} className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back
      </Link>
      <h1 className="mb-1 text-xl font-bold text-brand-700">
        {editingId !== null ? 'Edit entry' : `Add food · ${MEAL_LABELS[meal]}`}
      </h1>

      {!selected && (
        <>
          <input
            type="text"
            placeholder="Search foods (e.g. idli, sambar)"
            className="mt-3 w-full rounded border border-slate-300 px-3 py-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {query.trim() ? (
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg bg-white shadow-sm" data-testid="search-results">
              {results.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => setSelected({ kind: 'food', food: food as FoodRecord })}
                  >
                    {food.name}
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">No matches.</li>
              )}
            </ul>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {favorites.length > 0 && (
                <FoodChipList title="Favorites" foods={favorites} onSelect={(food) => setSelected({ kind: 'food', food })} />
              )}
              {recents.length > 0 && (
                <FoodChipList title="Recents" foods={recents} onSelect={(food) => setSelected({ kind: 'food', food })} />
              )}
              {recipes.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-slate-400">My Recipes</p>
                  <div className="flex flex-wrap gap-2">
                    {recipes.map((recipe) => (
                      <button
                        key={recipe.id}
                        type="button"
                        className="rounded-full bg-white px-3 py-1 text-sm shadow-sm"
                        onClick={() => setSelected({ kind: 'recipe', recipe })}
                      >
                        {recipe.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {foods && foods.length === 0 && (
                <p className="text-sm text-slate-400">Food database still loading…</p>
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{nameOf(selected)}</h2>
            <button type="button" className="text-sm text-slate-400 underline" onClick={() => setSelected(null)}>
              Change
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${mode === 'portion' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
              onClick={() => setMode('portion')}
            >
              Household unit
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${mode === 'grams' ? 'bg-brand-600 text-white' : 'bg-slate-100'}`}
              onClick={() => setMode('grams')}
            >
              Grams
            </button>
          </div>

          {mode === 'portion' ? (
            <div className="mt-3 flex flex-col gap-2">
              <select
                className="rounded border border-slate-300 px-3 py-2"
                value={portionIndex}
                onChange={(e) => setPortionIndex(Number(e.target.value))}
              >
                {portions.map((portion, i) => (
                  <option key={portion.label} value={i}>
                    {portion.label} ({portion.grams} g)
                  </option>
                ))}
              </select>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Quantity</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="rounded border border-slate-300 px-3 py-2"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-sm font-medium">Grams</span>
              <input
                type="number"
                min="0"
                className="rounded border border-slate-300 px-3 py-2"
                value={gramsValue}
                onChange={(e) => setGramsValue(e.target.value)}
              />
            </label>
          )}

          {preview && (
            <p className="mt-3 text-sm text-slate-600" data-testid="entry-preview">
              {Math.round(preview.kcal)} kcal · {preview.p}p / {preview.c}c / {preview.f}f
            </p>
          )}

          <button
            type="button"
            disabled={!preview || grams <= 0}
            onClick={handleSave}
            className="mt-4 w-full rounded bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {editingId !== null ? 'Save changes' : `Add to ${MEAL_LABELS[meal]}`}
          </button>
        </div>
      )}
    </div>
  )
}

function FoodChipList({
  title,
  foods,
  onSelect,
}: {
  title: string
  foods: FoodRecord[]
  onSelect: (food: FoodRecord) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {foods.map((food) => (
          <button
            key={food.id}
            type="button"
            className="rounded-full bg-white px-3 py-1 text-sm shadow-sm"
            onClick={() => onSelect(food)}
          >
            {food.name}
          </button>
        ))}
      </div>
    </div>
  )
}
