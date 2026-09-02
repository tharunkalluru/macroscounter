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

  it('does not repeat earlier words when the engine restates the whole utterance in each new result (an observed Android Chrome quirk)', () => {
    const onText = vi.fn()
    render(<Probe onText={onText} />)
    act(() => screen.getByText('start').click())

    // Each emit represents one onresult event whose single entry restates
    // the entire utterance recognized so far, rather than just the newest
    // word — naively summing every entry ever seen (the previous
    // implementation) turned this into "how how can how can i ...".
    act(() => lastInstance?.emit({ text: 'how', isFinal: false }))
    act(() => lastInstance?.emit({ text: 'how can', isFinal: false }))
    act(() => lastInstance?.emit({ text: 'how can i', isFinal: false }))
    act(() => lastInstance?.emit({ text: 'how can i reduce', isFinal: false }))
    act(() => lastInstance?.emit({ text: 'how can i reduce my', isFinal: false }))
    act(() => lastInstance?.emit({ text: 'how can i reduce my belly fat', isFinal: true }))

    expect(onText).toHaveBeenLastCalledWith('how can i reduce my belly fat')
  })

  it('appends a genuinely new utterance after a pause instead of losing the earlier one', () => {
    const onText = vi.fn()
    render(<Probe onText={onText} />)
    act(() => screen.getByText('start').click())

    act(() => lastInstance?.emit({ text: 'log a bowl of idli', isFinal: true }))
    expect(onText).toHaveBeenLastCalledWith('log a bowl of idli')

    // A new, unrelated phrase after the first one closed -- doesn't extend
    // (and isn't extended by) the prior text, so it's preserved alongside
    // it rather than replacing it.
    act(() => lastInstance?.emit({ text: 'also', isFinal: false }))
    expect(onText).toHaveBeenLastCalledWith('log a bowl of idli also')

    act(() => lastInstance?.emit({ text: 'also two boiled eggs', isFinal: true }))
    expect(onText).toHaveBeenLastCalledWith('log a bowl of idli also two boiled eggs')
  })

  it('restarts on its own when the engine ends the session without an explicit stop() (continuous: true not fully honored past a silence timeout)', () => {
    const onText = vi.fn()
    render(<Probe onText={onText} />)
    act(() => screen.getByText('start').click())
    const firstInstance = lastInstance

    act(() => firstInstance?.emit({ text: 'how can i', isFinal: true }))

    // The engine itself ends the session (e.g. a mid-sentence silence
    // timeout) -- the caller never clicked "stop".
    act(() => firstInstance?.onend?.())

    // Still listening from the caller's perspective, and a brand new
    // recognition instance has taken over transparently.
    expect(screen.getByTestId('listening')).toHaveTextContent('true')
    expect(lastInstance).not.toBe(firstInstance)
    expect(lastInstance?.start).toHaveBeenCalled()

    // The new instance's results build on the text from before the restart.
    act(() => lastInstance?.emit({ text: 'reduce belly fat', isFinal: true }))
    expect(onText).toHaveBeenLastCalledWith('how can i reduce belly fat')
  })
})
