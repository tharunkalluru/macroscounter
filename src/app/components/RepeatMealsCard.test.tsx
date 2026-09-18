import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computeMealSuggestions } from '../../domain/logging/suggestions'
import { logSuggestionChip } from '../../lib/logging/logSuggestionChip'
import RepeatMealsCard from './RepeatMealsCard'

vi.mock('../../lib/logging/logSuggestionChip', () => ({ logSuggestionChip: vi.fn() }))
vi.mock('../../domain/mealPrompt/activeMealWindow', () => ({ activeMealWindow: () => 'lunch' }))
const entries = [{ date: '2026-09-10', meal: 'lunch' as const, name: 'My bowl', qty: 1, unit: 'portion' as const, grams: 300, portionSummary: '1 bowl', kcal: 450, p: 20, c: 50, f: 12 }]
beforeEach(() => vi.clearAllMocks())

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
  it('lets the user inspect the full product with the keyboard before adding its unchanged portions and nutrition', async () => {
    vi.mocked(logSuggestionChip).mockResolvedValueOnce([101])
    const user = userEvent.setup()
    const original = {
      ...entries[0],
      name: 'Ultra Performance Chocolate Protein Shake with 30g protein and added vitamins',
      barcode: '0123456789012',
      portionSummary: '1 bottle (330 ml)',
      grams: 330,
      kcal: 160, p: 30, c: 5, f: 2,
    }
    const onLogged = vi.fn()
    render(<MemoryRouter><RepeatMealsCard date="2026-09-12" entries={[original]} onLogged={onLogged} /></MemoryRouter>)
    expect(screen.getByTestId('meal-suggestion-title')).toHaveTextContent('Protein shake')
    const toggle = screen.getByTestId('meal-suggestion-details-toggle')
    const details = screen.getByTestId('meal-suggestion-details')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', details.id)
    expect(details).not.toBeVisible()

    toggle.focus()
    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(details).toBeVisible()
    expect(details).toHaveTextContent(original.name)
    expect(details).toHaveTextContent('1 bottle (330 ml)')
    expect(details).toHaveTextContent('30 g protein')
    expect(details).toHaveTextContent('Barcode 0123456789012')
    expect(logSuggestionChip).not.toHaveBeenCalled()
    await user.keyboard(' ')
    expect(details).not.toBeVisible()
    expect(logSuggestionChip).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('repeat-meal'))
    expect(logSuggestionChip).toHaveBeenCalledTimes(1)
    expect(logSuggestionChip).toHaveBeenCalledWith(computeMealSuggestions([original], 'lunch', '2026-09-12')[0], 'lunch', '2026-09-12')
    expect(vi.mocked(logSuggestionChip).mock.calls[0][0].entries[0].snapshot).toMatchObject({ name: original.name, barcode: original.barcode, grams: 330, kcal: 160, p: 30, c: 5, f: 2 })
    await waitFor(() => expect(onLogged).toHaveBeenCalledTimes(1))
  })
  it('includes a summarized meal title in both control names while retaining the complete food identity', () => {
    const names = ['Ultra Performance Chocolate Protein Shake with 30g protein', 'Brown rice', 'Peanut butter']
    const meal = names.map((name) => ({ ...entries[0], name }))
    render(<MemoryRouter><RepeatMealsCard date="2026-09-12" entries={meal} onLogged={vi.fn()} /></MemoryRouter>)
    expect(screen.getByTestId('meal-suggestion-title')).toHaveTextContent('Protein shake + 2 more')
    expect(screen.getByTestId('meal-suggestion-details-toggle')).toHaveAccessibleName(`Show details for Protein shake + 2 more: ${names.join(' + ')}`)
    expect(screen.getByTestId('repeat-meal')).toHaveAccessibleName(`Add Protein shake + 2 more: ${names.join(' + ')}`)
  })
})
