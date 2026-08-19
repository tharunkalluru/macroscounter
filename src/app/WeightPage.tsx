import { Link } from 'react-router-dom'
import WeightSection from './components/WeightSection'

export default function WeightPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link
        to="/"
        className="mb-4 inline-flex min-h-touch items-center text-sm text-brand-700 dark:text-brand-400 underline"
      >
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700 dark:text-brand-400">Weight tracking</h1>
      <WeightSection />
    </div>
  )
}
