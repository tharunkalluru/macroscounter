import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FoodRecord, Meal, Recipe } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { RecipeRepo } from '../../data/repos/RecipeRepo'
import { computeMacrosForGrams, gramsForPortion } from '../../domain/logging/portionMath'
import { todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { nameOf, per100gOf, portionsOf, type Selected } from '../foodSelection'
import { useFoodIndex } from '../hooks/useFoodIndex'
import { BarcodeIcon } from '../shell/icons'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

interface Props {
  meal: Meal
  onSaved: () => void
  onRequestScan: () => void
  onRequestCustom: () => void
  onRequestNewRecipe: () => void
}

export default function AddFoodSheetContent({
  meal,
  onSaved,
  onRequestScan,
  onRequestCustom,
  onRequestNewRecipe,
}: Props) {
  const navigate = useNavigate()
  const { foods, service, loading } = useFoodIndex()

  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<FoodRecord[]>([])
  const [favorites, setFavorites] = useState<FoodRecord[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [portionIndex, setPortionIndex] = useState(0)
  const [mode, setMode] = useState<'portion' | 'grams'>('portion')
  const [qty, setQty] = useState('1')
  const [gramsValue, setGramsValue] = useState('100')

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

    await new LogRepo().addEntry({
      date: todayISO(),
      meal,
      foodId: selected.kind === 'food' ? selected.food.id : undefined,
      recipeId: selected.kind === 'recipe' ? selected.recipe.id : undefined,
      name: nameOf(selected),
      portionSummary,
      portionLabel: mode === 'portion' ? portions[portionIndex].label : undefined,
      qty: mode === 'grams' ? grams : Number(qty) || 0,
      unit: mode,
      grams,
      kcal: preview.kcal,
      p: preview.p,
      c: preview.c,
      f: preview.f,
    })
    vibrateTiny()
    onSaved()
  }

  function handleScan() {
    onRequestScan()
    navigate(`/scan?meal=${meal}`)
  }

  function handleCustom() {
    onRequestCustom()
    navigate(`/log/quick-add?meal=${meal}`)
  }

  function handleNewRecipe() {
    onRequestNewRecipe()
    navigate('/recipes/new')
  }

  if (loading) {
    return <div className="py-8 text-center text-slate-500 dark:text-slate-400">Loading…</div>
  }

  return (
    <div className="pb-2">
      {!selected && (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search foods (e.g. idli, sambar)"
              className="min-h-touch flex-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={handleScan}
              aria-label="Scan a barcode"
              data-testid="sheet-scan-button"
              className="flex min-h-touch min-w-touch items-center justify-center rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 text-slate-600 dark:text-slate-300"
            >
              <BarcodeIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCustom}
            data-testid="sheet-custom-button"
            className="mt-2 min-h-touch text-caption text-brand-700 dark:text-brand-400 underline"
          >
            Enter calories manually
          </button>

          {query.trim() ? (
            <ul
              className="mt-3 divide-y divide-slate-100 dark:divide-slate-700 rounded-lg bg-white dark:bg-surface-dark-card shadow-sm"
              data-testid="search-results"
            >
              {results.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    className="min-h-touch w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => setSelected({ kind: 'food', food: food as FoodRecord })}
                  >
                    {food.name}
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                  No matches.
                </li>
              )}
            </ul>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {favorites.length > 0 && (
                <FoodChipList
                  title="Favorites"
                  foods={favorites}
                  onSelect={(food) => setSelected({ kind: 'food', food })}
                />
              )}
              {recents.length > 0 && (
                <FoodChipList
                  title="Recents"
                  foods={recents}
                  onSelect={(food) => setSelected({ kind: 'food', food })}
                />
              )}
              <div>
                <p className="mb-1 text-caption font-medium uppercase text-slate-500 dark:text-slate-400">
                  My Recipes
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      className="min-h-touch rounded-full bg-white dark:bg-surface-dark-card px-3 py-1 text-sm shadow-sm"
                      onClick={() => setSelected({ kind: 'recipe', recipe })}
                    >
                      {recipe.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleNewRecipe}
                    data-testid="sheet-new-recipe-button"
                    className="min-h-touch rounded-full border border-dashed border-brand-700 px-3 py-1 text-sm text-brand-700 dark:border-brand-400 dark:text-brand-400"
                  >
                    + New recipe
                  </button>
                </div>
              </div>
              {foods && foods.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Food database still loading…
                </p>
              )}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="rounded-card bg-white dark:bg-surface-dark-card">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{nameOf(selected)}</h3>
            <button
              type="button"
              className="min-h-touch text-sm text-slate-500 dark:text-slate-400 underline"
              onClick={() => setSelected(null)}
            >
              Change
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={`min-h-touch rounded px-3 py-1 text-sm ${mode === 'portion' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'}`}
              onClick={() => setMode('portion')}
            >
              Household unit
            </button>
            <button
              type="button"
              className={`min-h-touch rounded px-3 py-1 text-sm ${mode === 'grams' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100'}`}
              onClick={() => setMode('grams')}
            >
              Grams
            </button>
          </div>

          {mode === 'portion' ? (
            <div className="mt-3 flex flex-col gap-2">
              <select
                className="min-h-touch rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
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
                  className="min-h-touch rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
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
                className="min-h-touch rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
                value={gramsValue}
                onChange={(e) => setGramsValue(e.target.value)}
              />
            </label>
          )}

          {preview && (
            <p
              className="mt-3 text-sm text-slate-600 dark:text-slate-300 tabular-nums"
              data-testid="entry-preview"
            >
              {Math.round(preview.kcal)} kcal · {preview.p}p / {preview.c}c / {preview.f}f
            </p>
          )}

          <button
            type="button"
            disabled={!preview || grams <= 0}
            onClick={handleSave}
            className="mt-4 min-h-touch w-full rounded bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {`Add to ${MEAL_LABELS[meal]}`}
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
      <p className="mb-1 text-caption font-medium uppercase text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {foods.map((food) => (
          <button
            key={food.id}
            type="button"
            className="min-h-touch rounded-full bg-white dark:bg-surface-dark-card px-3 py-1 text-sm shadow-sm"
            onClick={() => onSelect(food)}
          >
            {food.name}
          </button>
        ))}
      </div>
    </div>
  )
}
