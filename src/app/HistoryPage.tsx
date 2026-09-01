import MonthView from './components/MonthView'
import PageHeader from './components/PageHeader'

/**
 * Standalone legacy route (Phase R.3) — the Log tab's Month view is now the
 * primary way to reach this content, but `/history` keeps working
 * unchanged for any existing deep link or bookmark.
 */
export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Log" backTo="/" />
      <MonthView />
    </div>
  )
}
