import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CoachPage from './CoachPage'
import { todayISO, addDaysISO } from '../lib/date'

vi.mock('./shell/UIStateContext', () => ({ useUIState: () => ({ dataVersion: 0 }) }))
vi.mock('../lib/adaptive/fetchAdaptiveRecommendation', () => ({
  fetchAdaptiveRecommendation: async () => ({
    recommendation: null,
    review: null,
    alreadyAppliedThisWeek: false,
  }),
}))
vi.mock('../data/repos/ProfileRepo', () => ({
  ProfileRepo: class {
    get = async () => ({ goal: 'cut', goalWeightKg: 70, weightUnit: 'kg' })
  },
}))
vi.mock('../data/repos/TargetRepo', () => ({
  TargetRepo: class {
    getAll = async () => [
      { effectiveDate: '2026-01-01', kcal: 2000, proteinG: 120, source: 'computed' },
    ]
  },
}))
vi.mock('../data/repos/WeighInRepo', () => ({
  WeighInRepo: class {
    getAll = async () => [
      { date: '2026-01-01', weightKg: 80 },
      { date: todayISO(), weightKg: 82 },
    ]
  },
}))
vi.mock('../data/repos/LogRepo', () => ({
  LogRepo: class {
    getEntriesForDateRange = async () => [{ date: addDaysISO(todayISO(), -1), kcal: 300, p: 15 }]
  },
}))

describe('coach evidence summary', () => {
  it('labels partial records honestly and shows progress in the preferred unit without rewarding wrong-direction weight changes', async () => {
    render(
      <MemoryRouter>
        <CoachPage />
      </MemoryRouter>
    )
    expect(await screen.findByTestId('coach-week-brief')).toHaveTextContent('1/7 days logged')
    expect(screen.getByTestId('coach-week-brief')).toHaveTextContent('meals may be missing')
    expect(screen.getByTestId('strategy-goal-section')).toHaveTextContent('82.0 kg')
    expect(screen.getByTestId('strategy-goal-section')).toHaveTextContent('0% toward goal')
    expect(screen.getByTestId('coach-next-step')).toHaveTextContent(
      'Missing logs do not mean you ate less'
    )
  })
})
