import { Outlet } from 'react-router-dom'
import BottomSheet from './BottomSheet'
import BottomTabBar from './BottomTabBar'
import Header from './Header'
import PageTransition from './PageTransition'
import { useUIState } from './UIStateContext'
import AddFoodSheetContent from '../sheets/AddFoodSheetContent'

export default function AppShell() {
  const { addFoodSheet, closeAddFoodSheet, notifyDataChanged } = useUIState()

  function handleSaved() {
    notifyDataChanged()
    closeAddFoodSheet()
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <Header />
      <main className="pb-24">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <BottomTabBar />

      <BottomSheet open={addFoodSheet.open} onClose={closeAddFoodSheet} title="Add food">
        <AddFoodSheetContent
          meal={addFoodSheet.meal}
          onSaved={handleSaved}
          onRequestScan={closeAddFoodSheet}
          onRequestCustom={closeAddFoodSheet}
          onRequestNewRecipe={closeAddFoodSheet}
        />
      </BottomSheet>
    </div>
  )
}
