import { LogRepo } from '../data/repos/LogRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { computeExpenditureHistory } from '../domain/adaptive/expenditureHistory'
import { buildExpenditureCSV, buildLogsCSV, buildWeighInsCSV } from '../domain/export/csv'
import { groupEntriesByDate } from '../domain/history/averages'
import { todayISO } from '../lib/date'
import PageHeader from './components/PageHeader'

const EXPENDITURE_EXPORT_WEEKS = 26

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  async function handleExportLogs() {
    const entries = await new LogRepo().getEntriesForDateRange('0000-01-01', '9999-12-31')
    downloadCSV('bitewise-logs.csv', buildLogsCSV(entries))
  }

  async function handleExportWeighIns() {
    const weighIns = await new WeighInRepo().getAll()
    downloadCSV('bitewise-weighins.csv', buildWeighInsCSV(weighIns))
  }

  async function handleExportExpenditure() {
    const today = todayISO()
    const start = new Date(today)
    start.setDate(start.getDate() - EXPENDITURE_EXPORT_WEEKS * 7)
    const startISO = start.toISOString().slice(0, 10)

    const [entries, weighIns] = await Promise.all([
      new LogRepo().getEntriesForDateRange(startISO, today),
      new WeighInRepo().getInRange(startISO, today),
    ])
    const history = computeExpenditureHistory({
      loggedDays: groupEntriesByDate(entries),
      weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      referenceDate: today,
      weeks: EXPENDITURE_EXPORT_WEEKS,
    })
    downloadCSV('bitewise-expenditure.csv', buildExpenditureCSV(history))
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Export data" backTo="/settings" />
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Downloads a CSV file to this device — everything you've logged, in full.
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleExportLogs}
          className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Export food logs (CSV)
        </button>
        <button
          type="button"
          onClick={handleExportWeighIns}
          className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Export weigh-ins (CSV)
        </button>
        <button
          type="button"
          onClick={handleExportExpenditure}
          data-testid="export-expenditure"
          className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Export expenditure history (CSV)
        </button>
      </div>
    </div>
  )
}
