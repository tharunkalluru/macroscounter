import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CoachProgramUpdatePage from './CoachProgramUpdatePage'
import AdaptiveTargetPrompt from './components/AdaptiveTargetPrompt'
import { fetchAdaptiveRecommendation } from '../lib/adaptive/fetchAdaptiveRecommendation'

vi.mock('../lib/adaptive/fetchAdaptiveRecommendation', () => ({ fetchAdaptiveRecommendation: vi.fn() }))
vi.mock('./shell/UIStateContext', () => ({ useUIState: () => ({ notifyDataChanged: vi.fn() }) }))
beforeEach(() => { vi.clearAllMocks(); localStorage.clear() })

describe('adaptive review load recovery', () => {
  it('replaces a failed plan load with a retry action and recovers', async () => {
    vi.mocked(fetchAdaptiveRecommendation).mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValueOnce({ recommendation: null, review: null, alreadyAppliedThisWeek: false })
    render(<MemoryRouter><CoachProgramUpdatePage /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('program-update-none')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('handles a dashboard review load rejection instead of leaving an unhandled promise', async () => {
    vi.mocked(fetchAdaptiveRecommendation).mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValueOnce({ recommendation: null, review: null, alreadyAppliedThisWeek: false })
    render(<MemoryRouter><AdaptiveTargetPrompt /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(fetchAdaptiveRecommendation).toHaveBeenCalledTimes(2)
  })
})
