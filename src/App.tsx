import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import AddFoodPage from './app/AddFoodPage'
import Dashboard from './app/Dashboard'
import DayDetailPage from './app/DayDetailPage'
import HistoryPage from './app/HistoryPage'
import OnboardingFlow from './app/OnboardingFlow'
import QuickAddPage from './app/QuickAddPage'
import RecipeBuilderPage from './app/RecipeBuilderPage'
import ScanNotFoundPage from './app/ScanNotFoundPage'
import ScanPage from './app/ScanPage'
import ScanProductPage from './app/ScanProductPage'
import SettingsPage from './app/SettingsPage'
import WeightPage from './app/WeightPage'
import { ensureFoodDbSeeded } from './data/seed'

function App() {
  const [seeded, setSeeded] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    ensureFoodDbSeeded()
      .then(() => setSeeded(true))
      .catch((err) =>
        setSeedError(err instanceof Error ? err.message : 'Failed to load the food database')
      )
  }, [])

  if (seedError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-red-600">
        {seedError}
      </div>
    )
  }

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading MacroDesi…
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/onboarding" element={<OnboardingFlow />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/log/add" element={<AddFoodPage />} />
      <Route path="/log/edit/:entryId" element={<AddFoodPage />} />
      <Route path="/log/quick-add" element={<QuickAddPage />} />
      <Route path="/recipes/new" element={<RecipeBuilderPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/:date" element={<DayDetailPage />} />
      <Route path="/weight" element={<WeightPage />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/scan/product/:barcode" element={<ScanProductPage />} />
      <Route path="/scan/not-found/:barcode" element={<ScanNotFoundPage />} />
    </Routes>
  )
}

export default App
