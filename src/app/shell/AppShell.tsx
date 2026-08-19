import { Outlet } from 'react-router-dom'
import BottomSheet from './BottomSheet'
import BottomTabBar from './BottomTabBar'
import Header from './Header'
import { useUIState } from './UIStateContext'
import AddFoodSheetContent from '../sheets/AddFoodSheetContent'

export default function AppShell() {
  const { addFoodSheet, closeAddFoodSheet, notifyDataChanged } = useUIState()

  function handleSaved() {
    notifyDataChanged()
    closeAddFoodSheet()
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="pb-24">
        <Outlet />
      </main>
      <BottomTabBar />

      <BottomSheet open={addFoodSheet.open} onClose={closeAddFoodSheet} title="Add food">
        <AddFoodSheetContent
          meal={addFoodSheet.meal}
          onSaved={handleSaved}
          onRequestScan={closeAddFoodSheet}
        />
      </BottomSheet>
    </div>
  )
}
