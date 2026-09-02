import { Link } from 'react-router-dom'
import GoalWeightCard from './components/GoalWeightCard'
import PageHeader from './components/PageHeader'
import WeightSection from './components/WeightSection'

export default function WeightPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <div className="flex items-center justify-between">
        <PageHeader title="Weight tracking" backTo="/trends" />
        <Link
          to="/weight/entry"
          data-testid="weighin-entry-link"
          className="mb-4 min-h-touch rounded-full border border-brand-600 px-3.5 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-400"
        >
          Weigh in
        </Link>
      </div>
      <WeightSection />
      <div className="mt-4">
        <GoalWeightCard />
      </div>
    </div>
  )
}
