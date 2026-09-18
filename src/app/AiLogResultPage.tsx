import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { Meal } from '../data/models'
import type { FoodItemResult } from '../../api/ai/analyze'
import { EntryPhotoRepo } from '../data/repos/EntryPhotoRepo'
import { LogRepo } from '../data/repos/LogRepo'
import {
  attachReviewPhotos,
  commitReviewedMeal,
  createMealReviewItem,
  editMealReviewNutrient,
  REVIEW_NUTRIENTS,
  resizeMealReviewItem,
  reviewedFood,
  reviewTotals,
  type MealReviewItem,
} from '../domain/ai/mealReview'
import { base64ToBlob } from '../lib/ai/imageCompress'
import { getFoodDisplayName } from '../domain/logging/foodDisplayName'
import { diaryDate, diaryPath, isValidISODate, todayISO } from '../lib/date'
import { vibrateSuccess } from '../lib/haptics'
import FoodGlyph from './components/FoodGlyph'
import PageHeader from './components/PageHeader'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { SparkleIcon } from './shell/icons'
import { useUIState } from './shell/UIStateContext'

interface LocationState {
  meal: Meal
  items: FoodItemResult[]
  date?: string
  photo?: { data: string; mediaType: string }
}

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks']
const NUTRIENT_LABELS = {
  kcal: 'Calories',
  proteinG: 'Protein',
  carbsG: 'Carbs',
  fatG: 'Fat',
  fiberG: 'Fiber',
}

function isLocationState(state: unknown): state is LocationState {
  if (!state || typeof state !== 'object' || !Array.isArray((state as LocationState).items))
    return false
  return (state as LocationState).items.every(
    (item) =>
      item &&
      typeof item.name === 'string' &&
      (item.gramsEstimate === null ||
        (Number.isFinite(item.gramsEstimate) && item.gramsEstimate > 0)) &&
      REVIEW_NUTRIENTS.every((key) => Number.isFinite(item[key]) && item[key] >= 0)
  )
}

export default function AiLogResultPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notifyDataChanged } = useUIState()
  const savingRef = useRef(false)
  const committedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failedPhotoIds, setFailedPhotoIds] = useState<number[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const valid = isLocationState(location.state)
  const source: LocationState | null = valid ? location.state : null
  const [meal, setMeal] = useState<Meal>(() =>
    source && MEALS.includes(source.meal) ? source.meal : 'breakfast'
  )
  const [entryDate, setEntryDate] = useState(() => diaryDate(source?.date))
  const [items, setItems] = useState<MealReviewItem[]>(() =>
    (source?.items ?? []).map(createMealReviewItem)
  )
  const photo = source?.photo

  if (!valid) return <Navigate to="/log/ai" replace />

  const selectedCount = items.filter((item) => item.included).length
  const invalidItems = items.some((item) => item.included && !reviewedFood(item))
  const totals = reviewTotals(items)
  const dateValid = isValidISODate(entryDate) && entryDate <= todayISO()
  const manualPath = `/log/add?meal=${meal}&date=${diaryDate(entryDate)}`

  function updateItem(index: number, update: (item: MealReviewItem) => MealReviewItem) {
    setItems((previous) => previous.map((item, i) => (i === index ? update(item) : item)))
  }

  async function attachPhoto(id: number) {
    if (!photo) return
    const repo = new EntryPhotoRepo()
    // Retrying an attachment never creates a second diary entry or duplicate photo.
    if (await repo.getForEntry(id)) return
    await repo.attach(id, base64ToBlob(photo.data, photo.mediaType), photo.mediaType)
  }

  async function handleLogAll() {
    if (savingRef.current || committedRef.current || invalidItems || !dateValid || !selectedCount)
      return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const selected = items.filter((item) => item.included)
      const result = await commitReviewedMeal(
        () =>
          new LogRepo().addEntries(
            selected.map((item) => {
              const food = reviewedFood(item)!
              return {
                date: entryDate,
                meal,
                customSnapshot: {
                  name: food.name,
                  kcal: food.kcal,
                  p: food.proteinG,
                  c: food.carbsG,
                  f: food.fatG,
                  fiber: food.fiberG,
                },
                name: food.name,
                portionSummary: food.gramsEstimate
                  ? `${food.gramsEstimate} g (AI estimate)`
                  : `${item.amount} × estimated portion`,
                qty: 1,
                unit: 'portion' as const,
                grams: food.gramsEstimate ?? 0,
                kcal: food.kcal,
                p: food.proteinG,
                c: food.carbsG,
                f: food.fatG,
                fiber: food.fiberG,
              }
            })
          ),
        () => {
          // Commit is permanent even if optional, device-local photo storage fails.
          committedRef.current = true
          setSaved(true)
          notifyDataChanged()
          vibrateSuccess()
        },
        photo ? attachPhoto : undefined
      )
      setFailedPhotoIds(result.failedPhotoIds)
      if (!result.failedPhotoIds.length) navigate(diaryPath(entryDate), { replace: true })
    } catch {
      setError(
        committedRef.current
          ? 'Your meal is saved. Return to your diary to see it.'
          : 'Could not save this meal. Nothing was added; please try again.'
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function retryPhotos() {
    if (savingRef.current || !failedPhotoIds.length) return
    savingRef.current = true
    setSaving(true)
    const failures = await attachReviewPhotos(failedPhotoIds, attachPhoto)
    setFailedPhotoIds(failures)
    savingRef.current = false
    setSaving(false)
    if (!failures.length) navigate(diaryPath(entryDate), { replace: true })
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <PageHeader
        title={saved ? 'Meal saved' : 'Review your meal'}
        backTo={saved ? diaryPath(entryDate) : `/log/ai?meal=${meal}&date=${diaryDate(entryDate)}`}
      />
      {saved ? (
        <section className="rounded-card border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-surface-dark-card dark:shadow-card-dark mx-auto max-w-lg p-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-xl text-brand-700 dark:bg-slate-800 dark:text-brand-400"
          >
            ✓
          </span>
          <h2 className="text-title text-slate-900 dark:text-slate-100">
            Your food is in your diary
          </h2>
          <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {failedPhotoIds.length
              ? 'The meal saved successfully, but its photo could not be attached on this device. Retrying only saves the photo.'
              : 'Finishing your meal…'}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger-700 dark:text-danger-300">
              {error}
            </p>
          )}
          {!!failedPhotoIds.length && (
            <button
              type="button"
              onClick={retryPhotos}
              disabled={saving}
              className="pressable mt-5 min-h-touch w-full rounded-xl border border-brand-600 px-4 py-3 font-medium text-brand-700 disabled:opacity-50 dark:text-brand-400"
            >
              {saving ? 'Retrying photo…' : 'Retry photo attachment'}
            </button>
          )}
          <Link
            to={diaryPath(entryDate)}
            replace
            className="pressable mt-3 flex min-h-touch items-center justify-center rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white"
          >
            View diary
          </Link>
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-card border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-surface-dark-card dark:shadow-card-dark mx-auto max-w-lg p-6">
          <h2 className="text-title">No items found</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Try a clearer photo or describe the food and how much you had. You can also find it in
            search.
          </p>
          <Link
            to={manualPath}
            className="mt-4 flex min-h-touch items-center font-semibold text-brand-700 dark:text-brand-400"
          >
            Find food manually →
          </Link>
        </section>
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="shrink-0 text-brand-700 dark:text-brand-400">
                <SparkleIcon className="h-4 w-4" />
              </span>
              <p>AI estimates. Check foods and portions.</p>
            </div>
            <div className="flex flex-col gap-3" data-testid="ai-result-list">
              {items.map((item, i) => {
                const food = reviewedFood(item)
                const displayName = getFoodDisplayName(item.name)
                const accessibleName = displayName.isCompact ? `${displayName.title}: ${item.name}` : item.name
                const isEditing = editing === i
                return (
                  <article
                    key={i}
                    className={`rounded-card border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-surface-dark-card dark:shadow-card-dark overflow-hidden ${item.included && !food ? 'ring-2 ring-danger-500' : ''}`}
                  >
                    <div className="flex items-center gap-2 p-4">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(i, (value) => ({ ...value, included: !value.included }))
                        }
                        data-testid={`ai-result-item-${i}`}
                        aria-pressed={item.included}
                        aria-label={`${item.included ? 'Exclude' : 'Include'} ${accessibleName}`}
                        className="flex min-h-touch min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${item.included ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                        >
                          {item.included ? '✓' : ''}
                        </span>
                        <FoodGlyph name={item.name} />
                        <span className="min-w-0">
                          <span className="line-clamp-2 break-words font-semibold text-slate-900 dark:text-slate-100">
                            {displayName.title || 'Unnamed food'}
                          </span>
                          {displayName.variant && (
                            <span className="mt-1 block truncate text-caption text-slate-500 dark:text-slate-400">{displayName.variant}</span>
                          )}
                          <span className="mt-1 block text-caption text-slate-500 dark:text-slate-400">
                            {item.amount || '—'}{' '}
                            {item.original.gramsEstimate === null ? '× portion' : 'g'} ·{' '}
                            {item.original.confidence === 'low'
                              ? 'size estimated'
                              : 'quantity provided'}
                            {!item.included && ' · not included'}
                          </span>
                          <span className="sr-only">
                            {food
                              ? `${food.kcal} kcal · ${food.proteinG}P ${food.carbsG}C ${food.fatG}F ${food.fiberG}Fb`
                              : 'Check the values'}
                          </span>
                        </span>
                      </button>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                          {food?.kcal ?? '—'}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            kcal
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditing(isEditing ? null : i)}
                          aria-expanded={isEditing}
                          aria-controls={`food-editor-${i}`}
                          data-testid={`ai-edit-item-${i}`}
                          className="min-h-touch px-2 text-sm font-medium text-brand-700 dark:text-brand-400"
                        >
                          {isEditing ? 'Done' : 'Edit'}
                        </button>
                      </div>
                    </div>
                    {(displayName.isCompact || item.name.length > 48) && !isEditing && (
                      <details className="px-4 pb-2 text-caption" data-testid="food-name-details">
                        <summary className="min-h-touch cursor-pointer content-center font-medium text-brand-700 dark:text-brand-400">
                          Full name
                        </summary>
                        <p className="pb-2 break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300" data-testid="food-full-name">
                          {item.name}
                        </p>
                      </details>
                    )}
                    {isEditing && (
                      <div
                        id={`food-editor-${i}`}
                        className="border-t border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30"
                      >
                        <label className="block text-caption font-medium text-slate-600 dark:text-slate-300">
                          Food name
                          <input
                            value={item.name}
                            maxLength={200}
                            onChange={(event) =>
                              updateItem(i, (value) => ({ ...value, name: event.target.value }))
                            }
                            data-testid={`ai-item-name-${i}`}
                            className={`${TEXT_INPUT_CLASS} mt-1 w-full`}
                          />
                        </label>
                        <label className="mt-3 block text-caption font-medium text-slate-600 dark:text-slate-300">
                          {item.original.gramsEstimate === null
                            ? 'Portion multiplier'
                            : 'Portion in grams'}
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0.1"
                            max="100000"
                            step="any"
                            value={item.amount}
                            onChange={(event) =>
                              updateItem(i, (value) =>
                                resizeMealReviewItem(value, event.target.value)
                              )
                            }
                            data-testid={`ai-item-amount-${i}`}
                            className={`${TEXT_INPUT_CLASS} mt-1 w-full tabular-nums`}
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[0.5, 1, 1.5, 2].map((factor) => (
                            <button
                              key={factor}
                              type="button"
                              onClick={() =>
                                updateItem(i, (value) =>
                                  resizeMealReviewItem(
                                    value,
                                    String((value.original.gramsEstimate ?? 1) * factor)
                                  )
                                )
                              }
                              className="pressable min-h-touch rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-300"
                            >
                              {factor}× original
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-caption text-slate-500 dark:text-slate-400">
                          Nutrition adjusts with the portion.
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {REVIEW_NUTRIENTS.map((key) => (
                            <label
                              key={key}
                              className="min-w-0 text-caption font-medium text-slate-600 dark:text-slate-300"
                            >
                              {NUTRIENT_LABELS[key]} ({key === 'kcal' ? 'kcal' : 'g'})
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="100000"
                                step="any"
                                value={item.values[key]}
                                onChange={(event) =>
                                  updateItem(i, (value) =>
                                    editMealReviewNutrient(value, key, event.target.value)
                                  )
                                }
                                data-testid={`ai-item-${key}-${i}`}
                                className={`${TEXT_INPUT_CLASS} mt-1 w-full min-w-0 tabular-nums`}
                              />
                            </label>
                          ))}
                        </div>
                        {!food && (
                          <p
                            role="alert"
                            className="mt-3 text-sm text-danger-700 dark:text-danger-300"
                          >
                            Add a food name, a positive portion and valid nutrition values.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(i, (value) => ({
                              ...createMealReviewItem(value.original),
                              included: value.included,
                            }))
                          }
                          className="mt-2 min-h-touch text-caption font-medium text-slate-600 underline dark:text-slate-300"
                        >
                          Reset estimate
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            <p className="mt-4 text-caption leading-relaxed text-slate-500 dark:text-slate-400">
              Check for oils, sauces and drinks. Nutrition is estimated, even when you provide quantities.
            </p>
            <Link
              to={manualPath}
              className="mt-2 inline-flex min-h-touch items-center text-sm font-medium text-brand-700 dark:text-brand-400"
            >
              Search food instead →
            </Link>
          </div>
          <aside className="rounded-card border border-slate-200/70 bg-white shadow-card dark:border-slate-800 dark:bg-surface-dark-card dark:shadow-card-dark p-5 md:sticky md:top-6">
            <p className="text-caption font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Meal total
            </p>
            <p
              className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              data-testid="ai-review-total"
            >
              {totals.kcal}
              <span className="ml-2 text-sm font-normal tracking-normal text-slate-500 dark:text-slate-400">
                kcal
              </span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {(['proteinG', 'carbsG', 'fatG', 'fiberG'] as const).map((key) => (
                <div key={key}>
                  <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {totals[key]} g
                  </p>
                  <p className="text-caption text-slate-500 dark:text-slate-400">
                    {NUTRIENT_LABELS[key]}
                  </p>
                </div>
              ))}
            </div>
            <div className="my-5 border-t border-slate-100 dark:border-slate-800" />
            <label className="block text-caption font-medium text-slate-600 dark:text-slate-300">
              Meal
              <select
                value={meal}
                onChange={(event) => setMeal(event.target.value as Meal)}
                className={`${TEXT_INPUT_CLASS} mt-1 w-full capitalize`}
                data-testid="ai-review-meal"
              >
                {MEALS.map((value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-caption font-medium text-slate-600 dark:text-slate-300">
              Date
              <input
                type="date"
                value={entryDate}
                max={todayISO()}
                onChange={(event) => setEntryDate(event.target.value)}
                data-testid="ai-review-date"
                className={`${TEXT_INPUT_CLASS} mt-1 w-full min-w-0 dark:[color-scheme:dark]`}
              />
            </label>
            {!dateValid && (
              <p role="alert" className="mt-2 text-caption text-danger-700 dark:text-danger-300">
                Choose today or an earlier date.
              </p>
            )}
            {invalidItems && (
              <p role="alert" className="mt-3 text-caption text-danger-700 dark:text-danger-300">
                Check the highlighted values before saving.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger-700 dark:text-danger-300">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleLogAll}
              disabled={saving || !selectedCount || invalidItems || !dateValid}
              data-testid="ai-log-all-button"
              className="pressable mt-5 min-h-touch w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? 'Saving meal…'
                : `Log ${selectedCount} item${selectedCount === 1 ? '' : 's'}`}
            </button>
          </aside>
        </div>
      )}
    </main>
  )
}
