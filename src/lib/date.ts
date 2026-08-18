/** YYYY-MM-DD in the local timezone (never UTC — avoids off-by-one-day bugs for users west of UTC). */
export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isFutureDate(dateISO: string): boolean {
  return dateISO > todayISO()
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return toISODate(date)
}

/**
 * Cells for a month calendar grid: null padding for the leading weekdays
 * before the 1st, then one ISO date string per day of the month (no
 * trailing padding — callers render whatever rows that produces).
 */
export function getMonthGrid(year: number, monthIndex0: number): (string | null)[] {
  const firstWeekday = new Date(year, monthIndex0, 1).getDay()
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISODate(new Date(year, monthIndex0, day)))
  }
  return cells
}
