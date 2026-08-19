import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LogEntry } from '../../data/models'
import { useMealPrompt } from './useMealPrompt'

function entry(meal: LogEntry['meal']): LogEntry {
  return {
    id: 1,
    date: '2026-08-19',
    meal,
    name: 'Idli',
    portionSummary: '1 idli',
    qty: 1,
    unit: 'portion',
    grams: 40,
    kcal: 41,
    p: 1.8,
    c: 8,
    f: 0.2,
  }
}

function Probe({ entries, enabled }: { entries: LogEntry[]; enabled: boolean }) {
  const { meal, dismiss } = useMealPrompt(entries, enabled)
  return (
    <div>
      <span data-testid="meal">{meal ?? 'none'}</span>
      <button onClick={dismiss}>Not now</button>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useMealPrompt', () => {
  it('prompts for the active window when it has zero entries today', () => {
    vi.setSystemTime(new Date(2026, 7, 19, 8, 0)) // 08:00 -> breakfast window
    render(<Probe entries={[]} enabled />)
    expect(screen.getByTestId('meal')).toHaveTextContent('breakfast')
  })

  it('does not prompt when the active window already has an entry', () => {
    vi.setSystemTime(new Date(2026, 7, 19, 8, 0))
    render(<Probe entries={[entry('breakfast')]} enabled />)
    expect(screen.getByTestId('meal')).toHaveTextContent('none')
  })

  it('an entry in a different meal does not suppress the active window', () => {
    vi.setSystemTime(new Date(2026, 7, 19, 8, 0))
    render(<Probe entries={[entry('dinner')]} enabled />)
    expect(screen.getByTestId('meal')).toHaveTextContent('breakfast')
  })

  it('does not prompt at all during the 00:00-4:59 dead zone', () => {
    vi.setSystemTime(new Date(2026, 7, 19, 2, 30))
    render(<Probe entries={[]} enabled />)
    expect(screen.getByTestId('meal')).toHaveTextContent('none')
  })

  it('"Not now" suppresses the window for the rest of the day, even across a remount', () => {
    vi.setSystemTime(new Date(2026, 7, 19, 8, 0))
    const { unmount } = render(<Probe entries={[]} enabled />)
    expect(screen.getByTestId('meal')).toHaveTextContent('breakfast')

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.getByTestId('meal')).toHaveTextContent('none')

    // Simulate returning to the app later the same day (a fresh mount) —
    // the dismissal is persisted, so it must not prompt again.
    unmount()
    render(<Probe entries={[]} enabled />)
    expect(screen.getByTestId('meal')).toHaveTextContent('none')
  })

  it('is disabled entirely when `enabled` is false (e.g. viewing a past day)', () => {
    vi.setSystemTime(new Date(2026, 7, 19, 8, 0))
    render(<Probe entries={[]} enabled={false} />)
    expect(screen.getByTestId('meal')).toHaveTextContent('none')
  })
})
