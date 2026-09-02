import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { TargetRepo } from '../data/repos/TargetRepo'
import { deriveCurrentProgram } from '../domain/programs/program'
import { addDaysISO, isFutureDate, todayISO } from '../lib/date'
import InsightsSection from './components/InsightsSection'
import PageHeader from './components/PageHeader'
import ReportSection from './components/ReportSection'
import { ChevronLeftIcon, ChevronRightIcon } from './shell/icons'

function formatRange(weekEndDate: string): string {
  const start = addDaysISO(weekEndDate, -6)
  const [, sm, sd] = start.split('-').map(Number)
  const [, em, ed] = weekEndDate.split('-').map(Number)
  const startLabel = new Date(2000, sm - 1, sd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = new Date(2000, em - 1, ed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

/** A numbered, dated weekly report (frame 29) — `?week=` is that week's last day; omitted = this week. */
export default function TrendsReportPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = todayISO()
  const weekEndDate = searchParams.get('week') ?? today
  const isCurrentWeek = weekEndDate === today
  const [weekNumber, setWeekNumber] = useState<number | null>(null)

  useEffect(() => {
    new TargetRepo().getAll().then((targets) => {
      const program = deriveCurrentProgram(targets, weekEndDate)
      setWeekNumber(program?.weekNumber ?? null)
    })
  }, [weekEndDate])

  function goToWeek(nextWeekEnd: string) {
    navigate(nextWeekEnd === today ? '/trends/report' : `/trends/report?week=${nextWeekEnd}`)
  }

  const nextWeekEnd = addDaysISO(weekEndDate, 7)

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Weekly report" backTo="/trends" />

      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToWeek(addDaysISO(weekEndDate, -7))}
          aria-label="Previous week"
          data-testid="report-prev-week"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
        >
          <ChevronLeftIcon />
        </button>
        <div className="text-center">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {weekNumber !== null ? `Week ${weekNumber}` : 'This week'}
          </p>
          <p className="text-caption text-slate-500 dark:text-slate-400">{formatRange(weekEndDate)}</p>
        </div>
        <button
          type="button"
          onClick={() => goToWeek(nextWeekEnd)}
          disabled={isFutureDate(nextWeekEnd)}
          aria-label="Next week"
          data-testid="report-next-week"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 disabled:pointer-events-none disabled:opacity-30 dark:text-slate-400"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <ReportSection weekEndDate={weekEndDate} />

      <h2 className="mb-3 mt-8 text-title">Insights</h2>
      <InsightsSection />

      {isCurrentWeek && (
        <Link
          to="/coach/check-in"
          data-testid="report-start-checkin"
          className="mt-6 flex min-h-touch w-full items-center justify-center rounded-card bg-brand-700 px-4 py-3 text-sm font-medium text-white"
        >
          Start Monday check-in
        </Link>
      )}
    </div>
  )
}
