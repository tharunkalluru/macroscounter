import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ServingPortionStep from './ServingPortionStep'

const per100g = { kcal: 100, p: 5, c: 10, f: 2, fiber: 4 }

describe('ServingPortionStep', () => {
  it('scales manufacturer fiber with multiple servings and stores grams-mode quantity consistently', async () => {
    const onSave = vi.fn()
    render(<ServingPortionStep per100g={per100g} perServing={{ kcal: 51, p: 2.5, c: 5, f: 1, fiber: 2 }} servingSize={50} onSave={onSave} onSwitchToGrams={vi.fn()} />)
    fireEvent.click(screen.getByTestId('serving-chip-3'))
    fireEvent.click(screen.getByTestId('log-entry-button'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ grams: 150, qty: 150, unit: 'grams', kcal: 153, fiber: 6 }))
    await waitFor(() => expect(screen.getByTestId('log-entry-button')).not.toBeDisabled())
  })

  it('derives missing per-serving fiber from total grams', async () => {
    const onSave = vi.fn()
    render(<ServingPortionStep per100g={per100g} perServing={{ kcal: 51, p: 2.5, c: 5, f: 1 }} servingSize={50} initialServings={2} portionLabel="1 cup" onSave={onSave} onSwitchToGrams={vi.fn()} />)
    fireEvent.click(screen.getByTestId('log-entry-button'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ grams: 100, qty: 2, unit: 'portion', fiber: 4 }))
    await waitFor(() => expect(screen.getByTestId('log-entry-button')).not.toBeDisabled())
  })

  it('does not submit a duplicate while a save is pending and keeps errors actionable', async () => {
    let rejectSave!: (error: Error) => void
    const onSave = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject }))
    render(<ServingPortionStep per100g={per100g} servingSize={50} onSave={onSave} onSwitchToGrams={vi.fn()} />)
    fireEvent.click(screen.getByTestId('log-entry-button'))
    fireEvent.click(screen.getByTestId('log-entry-button'))
    expect(onSave).toHaveBeenCalledTimes(1)
    rejectSave(new Error('Storage unavailable'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save')
    expect(screen.getByTestId('log-entry-button')).not.toBeDisabled()
  })
})
