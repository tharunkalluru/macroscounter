import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ThemePreference } from '../domain/theme/resolveTheme'
import {
  getLargerNumbers,
  getReduceMotionPreference,
  setLargerNumbers,
  setReduceMotionPreference,
} from '../lib/settings/appearancePreferences'
import PageHeader from './components/PageHeader'
import SegmentedControl from './components/SegmentedControl'
import ToggleSwitch from './components/ToggleSwitch'
import { useTheme } from './shell/ThemeContext'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'contrast', label: 'Contrast' },
]

function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  return (
    <SegmentedControl
      label="Appearance"
      options={THEME_OPTIONS}
      value={preference}
      onChange={setPreference}
      testIdPrefix="theme-option"
    />
  )
}

export default function SettingsAppearancePage() {
  const [largerNumbers, setLargerNumbersState] = useState(getLargerNumbers)
  const [reduceMotion, setReduceMotionState] = useState(getReduceMotionPreference)

  function handleToggleLargerNumbers(enabled: boolean) {
    setLargerNumbers(enabled)
    setLargerNumbersState(enabled)
  }

  function handleToggleReduceMotion(enabled: boolean) {
    setReduceMotionPreference(enabled)
    setReduceMotionState(enabled)
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Appearance & export" backTo="/settings" />

      <ThemeToggle />

      <div className="mt-6 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Reading comfort</span>
        <ToggleSwitch
          label="Larger numbers"
          checked={largerNumbers}
          onChange={handleToggleLargerNumbers}
          testId="larger-numbers-toggle"
        />
        <ToggleSwitch
          label="Reduce motion"
          checked={reduceMotion}
          onChange={handleToggleReduceMotion}
          testId="reduce-motion-toggle"
        />
      </div>

      <div className="mt-6 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Export</span>
        <Link
          to="/export"
          className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400"
        >
          Export data
        </Link>
      </div>
    </div>
  )
}
