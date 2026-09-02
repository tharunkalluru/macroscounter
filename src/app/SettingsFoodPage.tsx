import { useState } from 'react'
import { getDefaultLogView, setDefaultLogView, type DefaultLogView } from '../lib/settings/logViewPreference'
import { getFoodSourcePreferences, setFoodSourcePreference } from '../lib/settings/foodSourcePreferences'
import PageHeader from './components/PageHeader'
import SegmentedControl from './components/SegmentedControl'
import ToggleSwitch from './components/ToggleSwitch'

const LOG_VIEW_OPTIONS: { value: DefaultLogView; label: string }[] = [
  { value: 'meals', label: 'Meals' },
  { value: 'timeline', label: 'Timeline' },
]

export default function SettingsFoodPage() {
  const [defaultView, setDefaultView] = useState(getDefaultLogView)
  const [foodSources, setFoodSources] = useState(getFoodSourcePreferences)

  function handleViewChange(view: DefaultLogView) {
    setDefaultLogView(view)
    setDefaultView(view)
  }

  function handleToggleFoodSource(source: 'off' | 'fdc', enabled: boolean) {
    setFoodSourcePreference(source, enabled)
    setFoodSources((prev) => ({ ...prev, [source]: enabled }))
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Food log & sources" backTo="/settings" />

      <SegmentedControl
        label="Default view"
        options={LOG_VIEW_OPTIONS}
        value={defaultView}
        onChange={handleViewChange}
        testIdPrefix="log-view"
      />

      <div className="mt-6 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Food sources</span>
        <span className="mb-2 text-caption text-slate-500 dark:text-slate-400">
          Which sources a barcode scan is allowed to look up.
        </span>
        <ToggleSwitch
          label="Open Food Facts"
          checked={foodSources.off}
          onChange={(enabled) => handleToggleFoodSource('off', enabled)}
          testId="food-source-off"
        />
        <ToggleSwitch
          label="USDA FoodData Central"
          checked={foodSources.fdc}
          onChange={(enabled) => handleToggleFoodSource('fdc', enabled)}
          testId="food-source-fdc"
        />
      </div>
    </div>
  )
}
