import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionResultItem {
  transcript: string
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionResultItem> {
  isFinal: boolean
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface MinimalSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface UseSpeechRecognitionResult {
  isSupported: boolean
  isListening: boolean
  start: () => void
  stop: () => void
}

/**
 * Thin wrapper around the browser's Web Speech API for voice-to-text
 * dictation (AI logging's mic button) -- `continuous: true` so it keeps
 * listening across pauses in speech until the caller explicitly stops it
 * (like Claude's or ChatGPT's voice input), not just a single short
 * utterance. Client-side only, free, zero extra latency -- no server audio
 * pipeline. `isSupported` is false on browsers without it (Firefox, most
 * Safari), so callers can hide the mic button entirely rather than show a
 * broken affordance.
 *
 * `onLiveTranscript` fires on every recognized chunk (interim *and* final)
 * with the full cumulative text recognized so far *in this listening
 * session* (not just what's new), giving a live, as-you-speak update in the
 * caller's text field.
 *
 * Two mobile-Chrome/Android quirks this specifically works around:
 *  - `continuous: true` isn't fully honored past a silence timeout -- the
 *    engine ends the session on its own after a pause mid-sentence. `onend`
 *    auto-restarts recognition when the caller didn't request the stop, so
 *    it still reads as one unbroken session (the accumulated text below
 *    survives the restart).
 *  - `event.results` isn't reliably one-entry-per-utterance: on some
 *    engines, each new entry restates the *whole utterance recognized so
 *    far* rather than just the newest word, and `resultIndex` doesn't
 *    reliably advance to say so. Naively summing every entry's transcript
 *    together (the previous implementation) double-counts on exactly this
 *    pattern, producing repeating prefixes ("how" / "how can" / "how can" /
 *    "how can i" / ... all concatenated). Only the single latest result
 *    entry is ever trusted as "what's being said" -- when it extends
 *    (or is extended by) what was already shown, it *replaces* that text
 *    rather than appending to it; only when it looks unrelated (a genuine
 *    new utterance after a pause) does it get appended after what came
 *    before.
 */
export function useSpeechRecognition(onLiveTranscript: (sessionText: string) => void): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
  const onLiveTranscriptRef = useRef(onLiveTranscript)
  onLiveTranscriptRef.current = onLiveTranscript

  // Text from utterances judged complete (a new, unrelated result showed up
  // after them) plus the latest known text for the utterance still growing.
  const committedTextRef = useRef('')
  const currentUtteranceRef = useRef('')
  const intentionalStopRef = useRef(false)
  const beginRef = useRef<() => void>(() => {})

  const Ctor = typeof window !== 'undefined' ? getSpeechRecognitionConstructor() : null

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true
      recognitionRef.current?.stop()
    }
  }, [])

  beginRef.current = () => {
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      if (event.results.length === 0) return
      const latest = event.results[event.results.length - 1]
      const latestText = latest[0]?.transcript ?? ''
      const prev = currentUtteranceRef.current

      const isRefinement = prev === '' || latestText.startsWith(prev) || prev.startsWith(latestText)
      if (!isRefinement) {
        committedTextRef.current += (committedTextRef.current && prev ? ' ' : '') + prev
      }
      currentUtteranceRef.current = latestText

      const sessionText =
        committedTextRef.current + (committedTextRef.current && latestText ? ' ' : '') + latestText
      onLiveTranscriptRef.current(sessionText)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => {
      recognitionRef.current = null
      if (intentionalStopRef.current) {
        setIsListening(false)
        return
      }
      // The engine ended the session on its own, not the caller -- restart
      // transparently (accumulated text carries over via committedTextRef/
      // currentUtteranceRef, neither reset here) so a mid-sentence pause
      // doesn't surface as "the mic stopped."
      beginRef.current()
    }
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const start = useCallback(() => {
    if (!Ctor || recognitionRef.current) return
    committedTextRef.current = ''
    currentUtteranceRef.current = ''
    intentionalStopRef.current = false
    beginRef.current()
  }, [Ctor])

  const stop = useCallback(() => {
    intentionalStopRef.current = true
    recognitionRef.current?.stop()
  }, [])

  return { isSupported: Ctor !== null, isListening, start, stop }
}
