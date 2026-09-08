import { Outlet } from 'react-router-dom'
import type { Meal } from '../../data/models'
import BottomSheet from './BottomSheet'
import BottomTabBar from './BottomTabBar'
import Header from './Header'
import PageTransition from './PageTransition'
import { useUIState } from './UIStateContext'
import AddFoodSheetContent from '../sheets/AddFoodSheetContent'
import GoalReachedTakeover from '../components/GoalReachedTakeover'
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
    <div className="min-h-screen bg-surface dark:bg-surface-dark lg:pl-52">
      <a href="#main-content" className="fixed -top-24 left-4 z-50 rounded-lg bg-white p-3 text-brand-700 focus:top-4">Skip to content</a>
      <InstallCoachMark />
      <GoalReachedTakeover />
      <Header />
      <main id="main-content" className="pb-24 lg:pb-10">
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
          onRequestAI={closeAddFoodSheet}
          onRequestLibrary={closeAddFoodSheet}
        />
      </BottomSheet>
    </div>
  )
}
