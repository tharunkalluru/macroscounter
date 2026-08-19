import ReportSection from './components/ReportSection'
import WeightSection from './components/WeightSection'

export default function TrendsPage() {
  return (
    <div className="mx-auto max-w-md px-6 pb-24 pt-2">
      <h1 className="sr-only">Trends</h1>
      <section>
        <h2 className="text-title mb-3">Weight</h2>
        <WeightSection />
      </section>

      <section className="mt-8">
        <h2 className="text-title mb-3">This week</h2>
        <ReportSection />
      </section>
    </div>
  )
}
