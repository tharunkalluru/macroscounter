import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AddFoodPage from './app/AddFoodPage'
import CoachPage from './app/CoachPage'
import Dashboard from './app/Dashboard'
import DayDetailPage from './app/DayDetailPage'
import ErrorBoundary from './app/components/ErrorBoundary'
import ExportPage from './app/ExportPage'
import HistoryPage from './app/HistoryPage'
import LogPage from './app/LogPage'
import OnboardingFlow from './app/OnboardingFlow'
import QuickAddPage from './app/QuickAddPage'
import RecipeBuilderPage from './app/RecipeBuilderPage'
import AppBootScreen from './app/shell/AppBootScreen'
import AppShell from './app/shell/AppShell'
import SyncTriggers from './app/shell/SyncTriggers'
import { ThemeProvider } from './app/shell/ThemeContext'
import { UIStateProvider } from './app/shell/UIStateContext'
import SettingsPage from './app/SettingsPage'
import SignInScreen from './app/SignInScreen'
import TemplateNewPage from './app/TemplateNewPage'
import TemplatesPage from './app/TemplatesPage'
import { ensureFoodDbSeeded } from './data/seed'

// Recharts (WeightPage/TrendsPage) and @zxing (Scan* pages) are large —
// route-lazy-loaded so they never enter the initial bundle, which is what
// keeps the app under the <300KB gz initial-JS budget (see scripts/check-bundle.ts).
const WeightPage = lazy(() => import('./app/WeightPage'))
const TrendsPage = lazy(() => import('./app/TrendsPage'))
const TrendsExpenditurePage = lazy(() => import('./app/TrendsExpenditurePage'))
const TrendsHabitsPage = lazy(() => import('./app/TrendsHabitsPage'))
const TrendsReportPage = lazy(() => import('./app/TrendsReportPage'))
const ScanPage = lazy(() => import('./app/ScanPage'))
const ScanProductPage = lazy(() => import('./app/ScanProductPage'))
const ScanNotFoundPage = lazy(() => import('./app/ScanNotFoundPage'))

function RouteLoading() {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
}

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
    return <AppBootScreen />
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UIStateProvider>
          <SyncTriggers />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Shell routes: header + bottom tab bar + FAB add-food sheet. */}
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/log" element={<LogPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/history/:date" element={<DayDetailPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/trends/expenditure" element={<TrendsExpenditurePage />} />
                <Route path="/trends/habits" element={<TrendsHabitsPage />} />
                <Route path="/trends/report" element={<TrendsReportPage />} />
                <Route path="/coach" element={<CoachPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/weight" element={<WeightPage />} />
                <Route path="/report" element={<Navigate to="/trends/report" replace />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/export" element={<ExportPage />} />
              </Route>

              {/* Full-screen task flows: no shell chrome. */}
              <Route path="/welcome" element={<SignInScreen />} />
              <Route path="/onboarding" element={<OnboardingFlow />} />
              <Route path="/log/add" element={<AddFoodPage />} />
              <Route path="/log/edit/:entryId" element={<AddFoodPage />} />
              <Route path="/log/quick-add" element={<QuickAddPage />} />
              <Route path="/recipes/new" element={<RecipeBuilderPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/scan/product/:barcode" element={<ScanProductPage />} />
              <Route path="/scan/not-found/:barcode" element={<ScanNotFoundPage />} />
              <Route path="/templates/new" element={<TemplateNewPage />} />
            </Routes>
          </Suspense>
        </UIStateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
