import InsightsSection from './components/InsightsSection'
import PageHeader from './components/PageHeader'
import ReportSection from './components/ReportSection'

export default function TrendsReportPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Weekly report" backTo="/trends" />

      <ReportSection />

      <h2 className="mb-3 mt-8 text-title">Insights</h2>
      <InsightsSection />
    </div>
  )
}
