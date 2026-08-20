import PageHeader from './components/PageHeader'
import WeightSection from './components/WeightSection'

export default function WeightPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Weight tracking" backTo="/history" />
      <WeightSection />
    </div>
  )
}
