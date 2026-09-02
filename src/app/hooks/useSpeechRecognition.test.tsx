import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechRecognition } from './useSpeechRecognition'

interface FakeResult extends ArrayLike<{ transcript: string }> {
  isFinal: boolean
}

class FakeSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((event: { resultIndex: number; results: ArrayLike<FakeResult> }) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())

  emit(...chunks: { text: string; isFinal: boolean }[]) {
    const results: FakeResult[] = chunks.map((c) => Object.assign([{ transcript: c.text }], { isFinal: c.isFinal }))
    this.onresult?.({ resultIndex: 0, results })
  }
}

let lastInstance: FakeSpeechRecognition | null = null

beforeEach(() => {
  lastInstance = null
  ;(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = class {
    constructor() {
      lastInstance = new FakeSpeechRecognition()
      return lastInstance
    }
  }
})

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition
})

function Probe({ onText }: { onText: (text: string) => void }) {
  const { isSupported, isListening, start, stop } = useSpeechRecognition(onText)
  return (
    <div>
      <span data-testid="supported">{String(isSupported)}</span>
      <span data-testid="listening">{String(isListening)}</span>
      <button onClick={start}>start</button>
      <button onClick={stop}>stop</button>
    </div>
  )
}

describe('useSpeechRecognition', () => {
  it('reports supported when the browser exposes SpeechRecognition', () => {
    render(<Probe onText={() => {}} />)
    expect(screen.getByTestId('supported')).toHaveTextContent('true')
  })

  it('sets continuous mode so it keeps listening across pauses until stopped', () => {
    render(<Probe onText={() => {}} />)
    act(() => screen.getByText('start').click())
    expect(lastInstance?.continuous).toBe(true)
    expect(lastInstance?.start).toHaveBeenCalled()
    expect(screen.getByTestId('listening')).toHaveTextContent('true')
  })

  it('reports the full cumulative session transcript on every result, not just the newest chunk', () => {
    const onText = vi.fn()
    render(<Probe onText={onText} />)
    act(() => screen.getByText('start').click())

    act(() => lastInstance?.emit({ text: 'a bowl of', isFinal: true }))
    expect(onText).toHaveBeenLastCalledWith('a bowl of')

    // A second speech burst after a pause -- continuous mode means this is
    // still the same session, so the callback gets everything said so far,
    // not just this new chunk.
    act(() => lastInstance?.emit({ text: 'a bowl of', isFinal: true }, { text: 'mixed vegetable curry', isFinal: false }))
    expect(onText).toHaveBeenLastCalledWith('a bowl of mixed vegetable curry')
  })

  it('stop() calls the underlying recognition and clears listening state', () => {
    render(<Probe onText={() => {}} />)
    act(() => screen.getByText('start').click())
    const instance = lastInstance
    act(() => screen.getByText('stop').click())
    expect(instance?.stop).toHaveBeenCalled()
    expect(screen.getByTestId('listening')).toHaveTextContent('false')
  })
})
