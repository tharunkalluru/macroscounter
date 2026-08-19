import { Outlet } from 'react-router-dom'
import type { Meal } from '../../data/models'
import BottomSheet from './BottomSheet'
import BottomTabBar from './BottomTabBar'
import Header from './Header'
import PageTransition from './PageTransition'
import { useUIState } from './UIStateContext'
import AddFoodSheetContent from '../sheets/AddFoodSheetContent'
import InstallCoachMark from '../components/InstallCoachMark'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

export default function AppShell() {
  const { addFoodSheet, closeAddFoodSheet, notifyDataChanged } = useUIState()

  function handleSaved() {
    notifyDataChanged()
    closeAddFoodSheet()
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <InstallCoachMark />
      <Header />
      <main className="pb-24">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <BottomTabBar />

      <BottomSheet
        open={addFoodSheet.open}
        onClose={closeAddFoodSheet}
        title={`Add to ${MEAL_LABELS[addFoodSheet.meal]}`}
      >
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
