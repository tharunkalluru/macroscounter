import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiLogResultPage from './AiLogResultPage'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  attach: vi.fn(),
  getPhoto: vi.fn(),
  changed: vi.fn(),
}))
vi.mock('../data/repos/LogRepo', () => ({
  LogRepo: class {
    addEntries = mocks.save
  },
}))
vi.mock('../data/repos/EntryPhotoRepo', () => ({
  EntryPhotoRepo: class {
    attach = mocks.attach
    getForEntry = mocks.getPhoto
  },
}))
vi.mock('./shell/UIStateContext', () => ({
  useUIState: () => ({ notifyDataChanged: mocks.changed }),
}))
vi.mock('../lib/haptics', () => ({ vibrateSuccess: vi.fn() }))

const food = {
  name: 'Rice bowl',
  gramsEstimate: 200,
  kcal: 260,
  proteinG: 5,
  carbsG: 56,
  fatG: 2,
  fiberG: 3,
  confidence: 'low',
}

function renderReview(withPhoto = false) {
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/log/ai/result',
          state: {
            meal: 'dinner',
            date: '2026-01-02',
            items: [food],
            ...(withPhoto ? { photo: { data: 'AA==', mediaType: 'image/png' } } : {}),
          },
        },
      ]}
    >
      <Routes>
        <Route path="/log/ai/result" element={<AiLogResultPage />} />
        <Route path="/log" element={<p>Diary destination</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.save.mockResolvedValue([41])
  mocks.attach.mockResolvedValue(1)
  mocks.getPhoto.mockResolvedValue(undefined)
})

describe('AI review save integrity', () => {
  it('commits corrected portions, name and destination only after confirmation', async () => {
    renderReview()
    fireEvent.click(screen.getByTestId('ai-edit-item-0'))
    fireEvent.change(screen.getByTestId('ai-item-name-0'), { target: { value: 'Small rice bowl' } })
    fireEvent.change(screen.getByTestId('ai-item-amount-0'), { target: { value: '100' } })
    fireEvent.change(screen.getByTestId('ai-review-meal'), { target: { value: 'lunch' } })
    expect(screen.getByTestId('ai-review-total')).toHaveTextContent('130')
    expect(mocks.save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('ai-log-all-button'))
    await screen.findByText('Diary destination')
    expect(mocks.save).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Small rice bowl',
        date: '2026-01-02',
        meal: 'lunch',
        grams: 100,
        kcal: 130,
        p: 2.5,
        fiber: 1.5,
      }),
    ])
  })
  it('leaves the review recoverable when the diary transaction fails', async () => {
    mocks.save.mockRejectedValueOnce(new Error('full'))
    renderReview()
    fireEvent.click(screen.getByTestId('ai-log-all-button'))
    await screen.findByText('Could not save this meal. Nothing was added; please try again.')
    expect(mocks.attach).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('ai-log-all-button'))
    await screen.findByText('Diary destination')
    expect(mocks.save).toHaveBeenCalledTimes(2)
  })
  it('preserves committed food when a photo fails and never saves it again on retry', async () => {
    mocks.attach.mockRejectedValueOnce(new Error('photo storage full')).mockResolvedValueOnce(1)
    renderReview(true)
    fireEvent.click(screen.getByTestId('ai-log-all-button'))
    await screen.findByRole('button', { name: 'Retry photo attachment' })
    expect(screen.getByRole('status')).toHaveTextContent('The meal saved successfully')
    expect(screen.queryByTestId('ai-log-all-button')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry photo attachment' }))
    await screen.findByText('Diary destination')
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.attach).toHaveBeenCalledTimes(2)
  })
  it('blocks duplicate save taps while the diary commit is pending', async () => {
    let resolve!: (ids: number[]) => void
    mocks.save.mockImplementation(
      () =>
        new Promise<number[]>((done) => {
          resolve = done
        })
    )
    renderReview()
    const save = screen.getByTestId('ai-log-all-button')
    fireEvent.click(save)
    fireEvent.click(save)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    resolve([41])
    await waitFor(() => expect(screen.getByText('Diary destination')).toBeInTheDocument())
  })
})
