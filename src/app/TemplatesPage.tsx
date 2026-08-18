import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Meal, MealTemplate } from '../data/models'
import { FoodRepo } from '../data/repos/FoodRepo'
import { LogRepo } from '../data/repos/LogRepo'
import { MealTemplateRepo } from '../data/repos/MealTemplateRepo'
import { applyTemplate } from '../domain/templates/applyTemplate'
import { todayISO } from '../lib/date'

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
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700">Templates</h1>

      <ul className="flex flex-col gap-3" data-testid="templates-list">
        {templates.map((template) => (
          <li key={template.id} className="rounded-lg bg-white p-4 shadow-sm">
            <p className="font-medium">{template.name}</p>
            <p className="text-xs text-slate-500">{template.entries.length} items</p>

            <div className="mt-3 flex items-center gap-2">
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={mealByTemplate[template.id!] ?? 'breakfast'}
                onChange={(e) =>
                  setMealByTemplate((prev) => ({ ...prev, [template.id!]: e.target.value as Meal }))
                }
              >
                {MEAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={logging === template.id}
                onClick={() => handleLogNow(template)}
                className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                {logging === template.id ? 'Logging…' : 'Log now'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(template.id)}
                className="ml-auto text-sm text-red-600 underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {templates.length === 0 && (
          <li className="text-sm text-slate-400">
            No templates yet — save a meal from the Today view as a template to see it here.
          </li>
        )}
      </ul>
    </div>
  )
}
