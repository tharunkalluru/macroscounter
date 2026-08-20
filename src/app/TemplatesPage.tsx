import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Meal, MealTemplate } from '../data/models'
import { FoodRepo } from '../data/repos/FoodRepo'
import { LogRepo } from '../data/repos/LogRepo'
import { MealTemplateRepo } from '../data/repos/MealTemplateRepo'
import { applyTemplate } from '../domain/templates/applyTemplate'
import { todayISO } from '../lib/date'
import PageHeader from './components/PageHeader'
import SegmentedControl from './components/SegmentedControl'

const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'dinner', label: 'Dinner' },
]

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<MealTemplate[]>([])
  const [mealByTemplate, setMealByTemplate] = useState<Record<number, Meal>>({})
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState<number | null>(null)

  async function load() {
    const all = await new MealTemplateRepo().listAll()
    setTemplates(all)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id?: number) {
    if (id === undefined) return
    await new MealTemplateRepo().delete(id)
    await load()
  }

  async function handleLogNow(template: MealTemplate) {
    if (template.id === undefined) return
    setLogging(template.id)
    try {
      const meal = mealByTemplate[template.id] ?? 'breakfast'
      const foodRepo = new FoodRepo()
      const foods = await foodRepo.getByIds(template.entries.map((e) => e.foodId))
      const foodsById = new Map(foods.map((f) => [f.id, f]))
      const resolved = applyTemplate(template.entries, foodsById)

      const logRepo = new LogRepo()
      const date = todayISO()
      for (const entry of resolved) {
        await logRepo.addEntry({ date, meal, ...entry })
      }
      navigate('/')
    } finally {
      setLogging(null)
    }
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
      <PageHeader title="Templates" backTo="/" />

      <ul className="flex flex-col gap-4" data-testid="templates-list">
        {templates.map((template) => (
          <li
            key={template.id}
            className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{template.name}</p>
                <p className="text-caption text-slate-500 dark:text-slate-400">
                  {template.entries.length} items
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(template.id)}
                aria-label={`Delete ${template.name}`}
                className="text-caption text-red-600 underline dark:text-red-400"
              >
                Delete
              </button>
            </div>

            <div className="mt-3">
              <SegmentedControl
                label="Meal"
                options={MEAL_OPTIONS}
                value={mealByTemplate[template.id!] ?? 'breakfast'}
                onChange={(value) =>
                  setMealByTemplate((prev) => ({ ...prev, [template.id!]: value }))
                }
                testIdPrefix={`template-${template.id}-meal`}
              />
            </div>
            <button
              type="button"
              disabled={logging === template.id}
              onClick={() => handleLogNow(template)}
              className="mt-3 min-h-touch w-full rounded-card bg-brand-700 px-3 py-2 text-sm font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {logging === template.id ? 'Logging…' : 'Log now'}
            </button>
          </li>
        ))}
        {templates.length === 0 && (
          <li className="text-sm text-slate-500 dark:text-slate-400">
            No templates yet — save a meal from the Today view as a template to see it here.
          </li>
        )}
      </ul>
    </div>
  )
}
