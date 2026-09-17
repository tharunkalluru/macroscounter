import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { logSuggestionChip } from '../../lib/logging/logSuggestionChip'
import RepeatMealsCard from './RepeatMealsCard'

vi.mock('../../lib/logging/logSuggestionChip', () => ({ logSuggestionChip: vi.fn() }))
vi.mock('../../domain/mealPrompt/activeMealWindow', () => ({ activeMealWindow: () => 'lunch' }))
const entries = [{ date: '2026-09-10', meal: 'lunch' as const, name: 'My bowl', qty: 1, unit: 'portion' as const, grams: 300, portionSummary: '1 bowl', kcal: 450, p: 20, c: 50, f: 12 }]

describe('repeat meal action', () => {
  it('preserves destination and prevents rapid double saves while the first save is pending', async () => {
    let finish!: (ids: number[]) => void
    vi.mocked(logSuggestionChip).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const onLogged = vi.fn()
    render(<MemoryRouter><RepeatMealsCard date="2026-09-12" entries={entries} onLogged={onLogged} /></MemoryRouter>)
    const button = screen.getByTestId('repeat-meal')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(logSuggestionChip).toHaveBeenCalledTimes(1)
    expect(logSuggestionChip).toHaveBeenCalledWith(expect.objectContaining({ label: 'My bowl' }), 'lunch', '2026-09-12')
    expect(button).toBeDisabled()
    finish([100])
    await waitFor(() => expect(onLogged).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent('Added to lunch')
  })
  it('gives an actionable failure without claiming a meal was added', async () => {
    vi.mocked(logSuggestionChip).mockRejectedValueOnce(new Error('disk unavailable'))
    const onLogged = vi.fn()
    render(<MemoryRouter><RepeatMealsCard date="2026-09-12" entries={entries} onLogged={onLogged} /></MemoryRouter>)
    fireEvent.click(screen.getByTestId('repeat-meal'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was added')
    expect(onLogged).not.toHaveBeenCalled()
    expect(screen.getByTestId('repeat-meal')).not.toBeDisabled()
  })
})
