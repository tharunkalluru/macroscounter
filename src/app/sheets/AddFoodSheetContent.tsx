import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FoodRecord, Meal, Recipe } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { RecipeRepo } from '../../data/repos/RecipeRepo'
import { todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { nameOf, type Selected } from '../foodSelection'
import { useFoodIndex } from '../hooks/useFoodIndex'
import PortionStep, { type PortionSaveData } from '../components/PortionStep'
import { BarcodeIcon } from '../shell/icons'

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
        <PortionStep
          selected={selected}
          onChangeFood={() => setSelected(null)}
          onSave={(data) => handleSave(selected, data)}
        />
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
