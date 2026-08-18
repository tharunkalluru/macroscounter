import { Route, Routes } from 'react-router-dom'
import Dashboard from './app/Dashboard'
import OnboardingFlow from './app/OnboardingFlow'
import SettingsPage from './app/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/onboarding" element={<OnboardingFlow />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App
