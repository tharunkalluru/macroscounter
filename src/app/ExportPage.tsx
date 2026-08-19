import { Link } from 'react-router-dom'
import { LogRepo } from '../data/repos/LogRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { buildLogsCSV, buildWeighInsCSV } from '../domain/export/csv'

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
    downloadCSV('macrodesi-logs.csv', buildLogsCSV(entries))
  }

  async function handleExportWeighIns() {
    const weighIns = await new WeighInRepo().getAll()
    downloadCSV('macrodesi-weighins.csv', buildWeighInsCSV(weighIns))
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-700 underline">
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700">Export data</h1>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleExportLogs}
          className="rounded bg-brand-700 px-4 py-2 font-medium text-white"
        >
          Export food logs (CSV)
        </button>
        <button
          type="button"
          onClick={handleExportWeighIns}
          className="rounded bg-brand-700 px-4 py-2 font-medium text-white"
        >
          Export weigh-ins (CSV)
        </button>
      </div>
    </div>
  )
}
