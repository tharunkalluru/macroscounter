import { Link } from 'react-router-dom'
import ReportSection from './components/ReportSection'

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link
        to="/"
        className="mb-4 inline-block text-sm text-brand-700 dark:text-brand-400 underline"
      >
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700 dark:text-brand-400">Weekly report</h1>
      <ReportSection />
    </div>
  )
}
