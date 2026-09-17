import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { FoodRecord, Meal, Recipe } from '../data/models'
import { FoodRepo } from '../data/repos/FoodRepo'
import { LogRepo } from '../data/repos/LogRepo'
import { RecipeRepo } from '../data/repos/RecipeRepo'
import { diaryDate, diaryPath } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import { useUIState } from './shell/UIStateContext'
import { nameOf, per100gOf, portionsOf, type Selected } from './foodSelection'
import { useFoodIndex } from './hooks/useFoodIndex'
import FoodChipList from './components/FoodChipList'
import FoodGlyph from './components/FoodGlyph'
import PageHeader from './components/PageHeader'
import PortionStep, { type PortionSaveData } from './components/PortionStep'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { HeartIcon, SparkleIcon } from './shell/icons'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

export default function AddFoodPage() {
  const [searchParams] = useSearchParams()
  const { entryId } = useParams()
  const navigate = useNavigate()
  const { notifyDataChanged } = useUIState()
  const { foods, service, loading } = useFoodIndex()

  const [meal, setMeal] = useState<Meal>((searchParams.get('meal') as Meal) || 'breakfast')
  const requestedDate = searchParams.get('date')
  const [entryDate, setEntryDate] = useState(
    diaryDate(requestedDate)
  )
  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<FoodRecord[]>([])
  const [favorites, setFavorites] = useState<FoodRecord[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingGrams, setEditingGrams] = useState<number | undefined>(undefined)

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

      setEditingGrams(entry.grams)
    })()
  }, [entryId])

  const results = useMemo(() => {
    if (!service || !query.trim()) return []
    return service.search(query, 20)
  }, [service, query])

  function isFavorite(food: FoodRecord): boolean {
    return favorites.some((f) => f.id === food.id)
  }

  async function handleToggleFavorite(food: FoodRecord) {
    await new FoodRepo().setFavorite(food.id, !isFavorite(food))
    setFavorites(await new FoodRepo().listFavorites())
  }

  async function handleSave(selected: Selected, data: PortionSaveData) {
    const entryData = {
      date: entryDate,
      meal,
      foodId: selected.kind === 'food' ? selected.food.id : undefined,
      recipeId: selected.kind === 'recipe' ? selected.recipe.id : undefined,
      name: nameOf(selected),
      ...data,
    }

    const logRepo = new LogRepo()
    if (editingId !== null) {
      await logRepo.updateEntry(editingId, entryData)
    } else {
      await logRepo.addEntry(entryData)
    }
    vibrateTiny()
    notifyDataChanged()
    navigate(backTo)
  }

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Getting your food search ready…
      </div>
    )
  }

  const backTo = diaryPath(entryDate)

  return (
    <div className="mx-auto max-w-lg px-5 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title={editingId !== null ? 'Edit entry' : `Add food · ${MEAL_LABELS[meal]}`}
        backTo={backTo}
      />

      {!selected && (
        <>
          <label htmlFor="page-food-search" className="mb-2 mt-5 block text-sm font-semibold text-slate-900 dark:text-slate-100">What did you eat?</label>
          <input
            id="page-food-search"
            type="text"
            placeholder="Search foods (e.g. idli, sambar)"
            className={`w-full ${TEXT_INPUT_CLASS}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate(`/log/ai?meal=${meal}&date=${entryDate}`)}
              data-testid="page-ai-button"
              className="pressable flex min-h-touch items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-brand-400"
            >
              <SparkleIcon className="h-4 w-4 shrink-0" />
              Describe with AI
            </button>
            <button
              type="button"
              onClick={() => navigate(`/log/quick-add?meal=${meal}&date=${entryDate}`)}
              data-testid="page-custom-button"
              className="pressable min-h-touch rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-200"
            >
              Custom entry
            </button>
          </div>

          {query.trim() ? (
            <ul
              className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-card border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-surface-dark-card"
              data-testid="search-results"
            >
              {results.map((food) => (
                <li key={food.id} className="flex items-center">
                  <button
                    type="button"
                    className="pressable flex min-h-touch min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left [@media(hover:hover)]:hover:bg-brand-50 dark:[@media(hover:hover)]:hover:bg-slate-800"
                    aria-label={food.name}
                    aria-describedby={`page-food-${food.id}-nutrition`}
                    onClick={() => setSelected({ kind: 'food', food: food as FoodRecord })}
                  >
                    <FoodGlyph name={food.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{food.name}</span>
                      <span id={`page-food-${food.id}-nutrition`} className="mt-1 block text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {Math.round(food.per100g.kcal)} kcal · {Math.round(food.per100g.p)} g protein / 100 g
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(food as FoodRecord)}
                    aria-label={
                      isFavorite(food as FoodRecord) ? `Remove ${food.name} from favorites` : `Add ${food.name} to favorites`
                    }
                    data-testid={`favorite-toggle-${food.id}`}
                    className="pressable mr-1 flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-slate-500 [@media(hover:hover)]:hover:bg-brand-50 dark:text-slate-400 dark:[@media(hover:hover)]:hover:bg-slate-800"
                  >
                    <HeartIcon
                      active={isFavorite(food as FoodRecord)}
                      className={
                        isFavorite(food as FoodRecord) ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                      }
                    />
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-5 py-6 text-center">
                  <div className="mb-3 flex justify-center"><FoodGlyph name="meal" /></div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">No matches.</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Try a simpler food name, describe your meal, or add a custom entry above.
                  </p>
                </li>
              )}
            </ul>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              {favorites.length === 0 && recents.length === 0 && (
                <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Search by food or ingredient. Your recent foods and favorites will be ready here next time.
                </p>
              )}

              {favorites.length > 0 && (
                <FoodChipList
                  title="Favorites"
                  foods={favorites}
                  onSelect={(food) => setSelected({ kind: 'food', food })}
                  isFavorite={isFavorite}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}
              {recents.length > 0 && (
                <FoodChipList
                  title="Recents"
                  foods={recents}
                  onSelect={(food) => setSelected({ kind: 'food', food })}
                  isFavorite={isFavorite}
                  onToggleFavorite={handleToggleFavorite}
                />
              )}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  My Recipes
                </p>
                <div className="flex flex-wrap gap-2">
                  {recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      className="pressable min-h-touch rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-200"
                      onClick={() => setSelected({ kind: 'recipe', recipe })}
                    >
                      {recipe.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate('/recipes/new')}
                    data-testid="page-new-recipe-button"
                    className="pressable min-h-touch rounded-xl border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-brand-400"
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
        <div className="mt-5 rounded-card border border-slate-200 bg-white p-4 shadow-card dark:border-slate-700 dark:bg-surface-dark-card dark:shadow-card-dark">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <FoodGlyph name={nameOf(selected)} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose your portion</p>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{nameOf(selected)}</h2>
              </div>
            </div>
            <button
              type="button"
              className="pressable min-h-touch shrink-0 rounded-xl px-3 text-sm font-medium text-brand-700 dark:text-brand-400"
              onClick={() => setSelected(null)}
            >
              Change
            </button>
          </div>
          <div className="mt-3">
            <PortionStep
              per100g={per100gOf(selected)}
              referencePortions={portionsOf(selected)}
              initialGrams={editingGrams}
              saveLabel={editingId !== null ? 'Save changes' : undefined}
              onSave={(data) => handleSave(selected, data)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
