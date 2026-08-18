import type { LogEntry, WeighIn } from '../../data/models'

export function escapeCsvField(value: string | number): string {
  const str = String(value)
  if (/["\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function rowsToCSV(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsvField).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(','))
  }
  return lines.join('\r\n')
}

const LOGS_HEADERS = ['date', 'meal', 'name', 'portionSummary', 'qty', 'unit', 'grams', 'kcal', 'p', 'c', 'f']

export function buildLogsCSV(entries: LogEntry[]): string {
  const rows = entries.map((e) => [
    e.date,
    e.meal,
    e.name,
    e.portionSummary,
    e.qty,
    e.unit,
    e.grams,
    e.kcal,
    e.p,
    e.c,
    e.f,
  ])
  return rowsToCSV(LOGS_HEADERS, rows)
}

const WEIGHINS_HEADERS = ['date', 'weightKg']

export function buildWeighInsCSV(weighIns: WeighIn[]): string {
  const rows = weighIns.map((w) => [w.date, w.weightKg])
  return rowsToCSV(WEIGHINS_HEADERS, rows)
}
