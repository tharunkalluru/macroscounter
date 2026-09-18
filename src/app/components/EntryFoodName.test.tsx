import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { LogEntry } from '../../data/models'
import EntryDetailSheet from './EntryDetailSheet'
import EntryRowVisual from './EntryRowVisual'
import EntryRow from './EntryRow'

vi.mock('../shell/UIStateContext', () => ({
  useUIState: () => ({ notifyDataChanged: vi.fn() }),
}))
vi.mock('../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))
vi.mock('../../data/repos/EntryPhotoRepo', () => ({
  EntryPhotoRepo: class {
    getForEntry = async () => undefined
  },
}))

const entry: LogEntry = {
  id: 1,
  date: '2026-09-18',
  meal: 'snacks',
  name: 'Ultra Nutrition High Protein Shake, Chocolate, 30g Protein, 330ml',
  barcode: '8901491101622',
  portionSummary: '1 bottle',
  qty: 1,
  unit: 'portion',
  grams: 0,
  kcal: 160,
  p: 30,
  c: 10,
  f: 2,
}

describe('logged food names', () => {
  it('keeps the original product identity in diary and reorder accessible names', () => {
    render(<MemoryRouter><EntryRow entry={entry} onSwipeDelete={vi.fn()} draggable /></MemoryRouter>)
    expect(screen.getByTestId('entry-row-1')).toHaveAccessibleName(`Edit Protein shake: ${entry.name}`)
    expect(screen.getByTestId('entry-drag-handle-1')).toHaveAccessibleName(`Reorder Protein shake: ${entry.name} to another meal`)
  })

  it('uses a compact diary title without changing the entry identity', () => {
    render(<EntryRowVisual entry={entry} />)
    expect(screen.getByTestId('entry-display-name')).toHaveTextContent('Protein shake')
    expect(screen.getByTestId('entry-display-name')).not.toHaveTextContent('Ultra Nutrition')
    expect(entry.name).toBe('Ultra Nutrition High Protein Shake, Chocolate, 30g Protein, 330ml')
  })

  it('reveals the original label and barcode in the sheet and passes that identity to editing', () => {
    const onEdit = vi.fn()
    render(<EntryDetailSheet open onClose={vi.fn()} entry={entry} onEdit={onEdit} />)
    expect(screen.getByRole('dialog', { name: 'Protein shake' })).toBeInTheDocument()
    expect(screen.getByTestId('entry-full-name')).toHaveTextContent(entry.name)
    expect(screen.getByText(`Barcode · ${entry.barcode}`)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('entry-detail-edit-button'))
    expect(onEdit).toHaveBeenCalledWith(entry)
  })

  it('keeps an unfamiliar long name readable in the body instead of a giant sheet heading', () => {
    const fullName = 'A family recipe with an unfamiliar name and a very detailed preparation description'
    render(<EntryDetailSheet open onClose={vi.fn()} entry={{ ...entry, name: fullName }} onEdit={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Food details' })).toBeInTheDocument()
    expect(screen.getByTestId('entry-full-name')).toHaveTextContent(fullName)
  })
})
