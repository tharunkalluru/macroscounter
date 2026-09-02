import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { FoodRecord, Meal, Recipe } from '../data/models'
import { FoodRepo } from '../data/repos/FoodRepo'
import { LogRepo } from '../data/repos/LogRepo'
import { RecipeRepo } from '../data/repos/RecipeRepo'
import { computeMacrosForGrams } from '../domain/logging/portionMath'
import { todayISO } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import PageHeader from './components/PageHeader'
import { HeartIcon } from './shell/icons'
import { useUIState } from './shell/UIStateContext'

type Tab = 'recipes' | 'my-foods' | 'quick-add'
const TABS: { key: Tab; label: string }[] = [
  { key: 'recipes', label: 'Recipes' },
  { key: 'my-foods', label: 'My foods' },
  { key: 'quick-add', label: 'Quick add' },
]

/**
 * The unified Library screen (frame 24) — browsable recipes with a
 * macro-proportion bar and one-tap re-log (the design's Recipes tab shows
 * this; the app previously only had a recipe *creator*, no browsable list),
 * favorited foods as "My foods", and a link into the existing Quick-add form.
 */
export default function LibraryPage() {
  const navigate = useNavigate()
  const { notifyDataChanged } = useUIState()
  const [searchParams] = useSearchParams()
  const meal = (searchParams.get('meal') as Meal) ?? 'breakfast'
  const [tab, setTab] = useState<Tab>('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [favorites, setFavorites] = useState<FoodRecord[]>([])
  const [loggedKey, setLoggedKey] = useState<string | null>(null)

  useEffect(() => {
    new RecipeRepo().listAll().then(setRecipes)
    new FoodRepo().listFavorites().then(setFavorites)
  }, [])

  async function handleLogRecipe(recipe: Recipe) {
    const gramsPerServing = recipe.ingredients.reduce((s, i) => s + i.grams, 0) / recipe.servings
    const macros = computeMacrosForGrams(recipe.computedPer100g, gramsPerServing)
    await new LogRepo().addEntry({
      date: todayISO(),
      meal,
      recipeId: recipe.id,
      name: recipe.name,
      portionSummary: '1 serving',
      qty: 1,
      unit: 'portion',
      grams: gramsPerServing,
      ...macros,
    })
    vibrateTiny()
    notifyDataChanged()
    setLoggedKey(`recipe-${recipe.id}`)
  }

  async function handleLogFavorite(food: FoodRecord) {
    const grams = food.portions[0]?.grams ?? 100
    const macros = computeMacrosForGrams(food.per100g, grams)
    await new LogRepo().addEntry({
      date: todayISO(),
      meal,
      foodId: food.id,
      name: food.name,
      portionSummary: food.portions[0] ? `1 ${food.portions[0].label}` : `${grams} g`,
      qty: 1,
      unit: food.portions[0] ? 'portion' : 'grams',
      portionLabel: food.portions[0]?.label,
      grams,
      ...macros,
    })
    vibrateTiny()
    notifyDataChanged()
    setLoggedKey(`food-${food.id}`)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <PageHeader title="Library" backTo="/" />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Library">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            data-testid={`library-tab-${t.key}`}
            className={`min-h-touch flex-1 rounded-md text-sm font-medium transition-transform active:scale-[0.97] ${
              tab === t.key
                ? 'bg-white text-brand-700 shadow-sm dark:bg-surface-dark-card dark:text-brand-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recipes' && (
        <div className="flex flex-col gap-2" data-testid="library-recipes-list">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              logged={loggedKey === `recipe-${recipe.id}`}
              onLog={() => handleLogRecipe(recipe)}
            />
          ))}
          {recipes.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No recipes saved yet.</p>
          )}
          <button
            type="button"
            onClick={() => navigate('/recipes/new')}
            data-testid="library-new-recipe"
            className="min-h-touch rounded-card border border-dashed border-brand-600 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-400"
          >
            + New recipe
          </button>
        </div>
      )}

      {tab === 'my-foods' && (
        <div className="flex flex-col gap-2" data-testid="library-my-foods-list">
          {favorites.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => handleLogFavorite(food)}
              data-testid={`library-food-${food.id}`}
              className="flex min-h-touch items-center gap-3 rounded-card border border-slate-200 bg-white p-3.5 text-left dark:border-slate-700 dark:bg-surface-dark-card"
            >
              <HeartIcon active className="flex-none text-brand-600 dark:text-brand-400" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">{food.name}</span>
              <span className="flex-none rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-600 dark:text-brand-400 dark:ring-brand-400">
                {loggedKey === `food-${food.id}` ? 'Logged' : 'Log'}
              </span>
            </button>
          ))}
          {favorites.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Favorite a food from search to see it here.
            </p>
          )}
        </div>
      )}

      {tab === 'quick-add' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Log by numbers alone — no food, no serving size, just kcal and macros.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/log/quick-add?meal=${meal}`)}
            data-testid="library-quick-add-link"
            className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 text-sm font-medium text-white"
          >
            Open quick add
          </button>
        </div>
      )}
    </div>
  )
}

function RecipeCard({ recipe, logged, onLog }: { recipe: Recipe; logged: boolean; onLog: () => void }) {
  const gramsPerServing = recipe.ingredients.reduce((s, i) => s + i.grams, 0) / recipe.servings
  const { kcal, p, c, f } = computeMacrosForGrams(recipe.computedPer100g, gramsPerServing)
  const kcalFromMacro = { p: p * 4, c: c * 4, f: f * 9 }
  const totalKcalFromMacro = kcalFromMacro.p + kcalFromMacro.c + kcalFromMacro.f || 1
  const pct = useMemo(
    () => ({
      p: (kcalFromMacro.p / totalKcalFromMacro) * 100,
      c: (kcalFromMacro.c / totalKcalFromMacro) * 100,
      f: (kcalFromMacro.f / totalKcalFromMacro) * 100,
    }),
    [kcalFromMacro.p, kcalFromMacro.c, kcalFromMacro.f, totalKcalFromMacro]
  )

  return (
    <div className="rounded-card border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-surface-dark-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{recipe.name}</p>
          <p className="text-caption text-slate-500 dark:text-slate-400">
            {recipe.servings} servings · {Math.round(kcal)} kcal/serving
          </p>
        </div>
        <button
          type="button"
          onClick={onLog}
          data-testid={`library-recipe-log-${recipe.id}`}
          className="flex-none rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-600 dark:text-brand-400 dark:ring-brand-400"
        >
          {logged ? 'Logged' : 'Log'}
        </button>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
        <div className="h-full bg-protein-500" style={{ width: `${pct.p}%` }} />
        <div className="h-full bg-carbs-500" style={{ width: `${pct.c}%` }} />
        <div className="h-full bg-fat-500" style={{ width: `${pct.f}%` }} />
      </div>
      <p className="mt-1 text-caption text-slate-400 dark:text-slate-500">
        {Math.round(p)}g protein · {Math.round(c)}g carbs · {Math.round(f)}g fat
      </p>
    </div>
  )
}
