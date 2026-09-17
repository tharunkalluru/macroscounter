import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FoodRecord, Meal, Recipe } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { RecipeRepo } from '../../data/repos/RecipeRepo'
import { todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { nameOf, per100gOf, portionsOf, type Selected } from '../foodSelection'
import { useFoodIndex } from '../hooks/useFoodIndex'
import FoodChipList from '../components/FoodChipList'
import FoodGlyph from '../components/FoodGlyph'
import PortionStep, { type PortionSaveData } from '../components/PortionStep'
import { TEXT_INPUT_CLASS } from '../components/formStyles'
import { BarcodeIcon, HeartIcon } from '../shell/icons'

interface Props {
  meal: Meal
  onSaved: () => void
  onRequestScan: () => void
  onRequestCustom: () => void
  onRequestNewRecipe: () => void
  onRequestAI: () => void
  onRequestLibrary: () => void
}

type SheetTab = 'search' | 'scan' | 'ai' | 'quick' | 'library'
const SHEET_TABS: { key: SheetTab; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'scan', label: 'Scan' },
  { key: 'ai', label: 'AI' },
  { key: 'quick', label: 'Quick' },
  { key: 'library', label: 'Library' },
]

export default function AddFoodSheetContent({
  meal,
  onSaved,
  onRequestScan,
  onRequestCustom,
  onRequestNewRecipe,
  onRequestAI,
  onRequestLibrary,
}: Props) {
  const navigate = useNavigate()
  const { foods, service, loading } = useFoodIndex()

  const [query, setQuery] = useState('')
  const [recents, setRecents] = useState<FoodRecord[]>([])
  const [favorites, setFavorites] = useState<FoodRecord[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selected, setSelected] = useState<Selected | null>(null)

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

  function isFavorite(food: FoodRecord): boolean {
    return favorites.some((f) => f.id === food.id)
  }

  async function handleToggleFavorite(food: FoodRecord) {
    await new FoodRepo().setFavorite(food.id, !isFavorite(food))
    setFavorites(await new FoodRepo().listFavorites())
  }

  async function handleSave(selected: Selected, data: PortionSaveData) {
    await new LogRepo().addEntry({
      date: todayISO(),
      meal,
      foodId: selected.kind === 'food' ? selected.food.id : undefined,
      recipeId: selected.kind === 'recipe' ? selected.recipe.id : undefined,
      name: nameOf(selected),
      ...data,
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

  function handleTabSelect(tab: SheetTab) {
    if (tab === 'search') return
    if (tab === 'scan') return handleScan()
    if (tab === 'ai') {
      onRequestAI()
      navigate(`/log/ai?meal=${meal}`)
      return
    }
    if (tab === 'quick') return handleCustom()
    if (tab === 'library') {
      onRequestLibrary()
      navigate(`/log/library?meal=${meal}`)
    }
  }

  if (loading) {
    return <div role="status" className="rounded-card bg-brand-50 px-4 py-8 text-center text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Getting your food search ready…</div>
  }

  return (
    <div className="pb-2">
      {!selected && (
        <>
          <div className="mb-4 flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Add food method">
            {SHEET_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.key === 'search'}
                onClick={() => handleTabSelect(t.key)}
                data-testid={`sheet-tab-${t.key}`}
                className={`pressable min-h-touch min-w-0 flex-1 rounded-xl text-caption font-medium ${
                  t.key === 'search'
                    ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 dark:bg-surface-dark-card dark:text-brand-400 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label htmlFor="sheet-food-search" className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">What did you eat?</label>
          <div className="flex items-center gap-2">
            <input
              id="sheet-food-search"
              type="text"
              placeholder="Search foods (e.g. idli, sambar)"
              className={`min-w-0 flex-1 ${TEXT_INPUT_CLASS}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={handleScan}
              aria-label="Scan a barcode"
              data-testid="sheet-scan-button"
              className="pressable flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-brand-700 dark:border-slate-700 dark:bg-surface-dark-card dark:text-brand-400"
            >
              <BarcodeIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCustom}
            data-testid="sheet-custom-button"
            className="pressable mt-1 min-h-touch rounded-xl text-caption font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 dark:text-brand-400 dark:decoration-slate-600"
          >
            Enter calories manually
          </button>

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
                    aria-describedby={`sheet-food-${food.id}-nutrition`}
                    onClick={() => setSelected({ kind: 'food', food: food as FoodRecord })}
                  >
                    <FoodGlyph name={food.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{food.name}</span>
                      <span id={`sheet-food-${food.id}-nutrition`} className="mt-1 block text-xs tabular-nums text-slate-500 dark:text-slate-400">
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
                    Try a simpler food name, scan the package, or enter the calories yourself.
                  </p>
                  <button type="button" onClick={handleCustom} className="pressable mt-4 min-h-touch rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white dark:bg-brand-400 dark:text-slate-950">
                    Create a custom entry
                  </button>
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
                    onClick={handleNewRecipe}
                    data-testid="sheet-new-recipe-button"
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
        <div className="rounded-card bg-white dark:bg-surface-dark-card">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3 dark:bg-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <FoodGlyph name={nameOf(selected)} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose your portion</p>
                <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{nameOf(selected)}</h3>
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
              onSave={(data) => handleSave(selected, data)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
