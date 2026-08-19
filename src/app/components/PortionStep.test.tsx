import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FoodRecord } from '../../data/models'
import type { Selected } from '../foodSelection'
import PortionStep from './PortionStep'

const food: FoodRecord = {
  id: 'test-food',
  name: 'Test Food',
  aliases: [],
  category: 'general',
  per100g: { kcal: 150, p: 12, c: 18, f: 6, fiber: 0 },
  portions: [{ label: '1 cup', grams: 80 }],
  source: 'test',
  verified: true,
}

const selected: Selected = { kind: 'food', food }

describe('PortionStep', () => {
  it('defaults the grams field to the food\'s typical (first) portion', () => {
    render(<PortionStep selected={selected} onChangeFood={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByTestId('portion-grams-input')).toHaveValue(80)
  })

  it('the live preview reflects gram->macro math for the current grams value', () => {
    render(<PortionStep selected={selected} onChangeFood={vi.fn()} onSave={vi.fn()} />)
    // 80g of {150,12,18,6} per 100g -> 120 kcal / 9.6p / 14.4c / 4.8f
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('120 kcal · 9.6p / 14.4c / 4.8f')
  })

  it('a fixed quick-adjust chip (e.g. 150 g) fills the field and updates the preview', () => {
    render(<PortionStep selected={selected} onChangeFood={vi.fn()} onSave={vi.fn()} />)
    fireEvent.click(screen.getByTestId('gram-chip-150'))
    expect(screen.getByTestId('portion-grams-input')).toHaveValue(150)
    // 150g -> 225 kcal / 18p / 27c / 9f
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('225 kcal · 18p / 27c / 9f')
  })

  it('the food\'s reference-portion chip fills the field with its own gram value, not a raw multiplier', () => {
    render(<PortionStep selected={selected} onChangeFood={vi.fn()} onSave={vi.fn()} />)
    const chip = screen.getByTestId('gram-chip-portion')
    expect(chip).toHaveTextContent('1 cup ≈ 80 g')
    fireEvent.click(chip)
    expect(screen.getByTestId('portion-grams-input')).toHaveValue(80)
  })

  it('typing a value that produces a non-round macro result still displays it correctly rounded', () => {
    render(<PortionStep selected={selected} onChangeFood={vi.fn()} onSave={vi.fn()} />)
    fireEvent.change(screen.getByTestId('portion-grams-input'), { target: { value: '33' } })
    // 33g of 12p per 100g = 3.96 -> rounds to 4 (not 3.96 or 3.9)
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('4p')
  })

  it('the log button shows the live "Add {grams} g · {kcal} kcal" result and saves grams-only', () => {
    const onSave = vi.fn()
    render(<PortionStep selected={selected} onChangeFood={vi.fn()} onSave={onSave} />)
    expect(screen.getByTestId('log-entry-button')).toHaveTextContent('Add 80 g · 120 kcal')

    fireEvent.click(screen.getByTestId('log-entry-button'))
    expect(onSave).toHaveBeenCalledWith({
      portionSummary: '80 g',
      qty: 80,
      unit: 'grams',
      grams: 80,
      kcal: 120,
      p: 9.6,
      c: 14.4,
      f: 4.8,
    })
  })

  it('edit mode pre-fills from the entry\'s existing grams, not the food\'s typical portion', () => {
    render(
      <PortionStep selected={selected} initialGrams={250} saveLabel="Save changes" onChangeFood={vi.fn()} onSave={vi.fn()} />
    )
    expect(screen.getByTestId('portion-grams-input')).toHaveValue(250)
    expect(screen.getByTestId('log-entry-button')).toHaveTextContent('Save changes')
  })
})
