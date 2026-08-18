/** YYYY-MM-DD in the local timezone (never UTC — avoids off-by-one-day bugs for users west of UTC). */
export function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
