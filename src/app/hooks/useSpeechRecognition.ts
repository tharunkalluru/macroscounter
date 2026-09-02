import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionResultItem {
  transcript: string
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionResultItem> {
  isFinal: boolean
}

interface SpeechRecognitionEventLike {
  resultIndex: number
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
 * session* (not just what's new) -- `event.results` itself accumulates the
 * whole session, so recomputing the join each time is simpler and less
 * error-prone than tracking committed-vs-interim state by hand, and gives a
 * live, as-you-speak update in the caller's text field.
 */
export function useSpeechRecognition(onLiveTranscript: (sessionText: string) => void): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
  const onLiveTranscriptRef = useRef(onLiveTranscript)
  onLiveTranscriptRef.current = onLiveTranscript

  const Ctor = typeof window !== 'undefined' ? getSpeechRecognitionConstructor() : null

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Ctor || recognitionRef.current) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      let sessionText = ''
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript ?? ''
        sessionText += (sessionText && transcript ? ' ' : '') + transcript
      }
      onLiveTranscriptRef.current(sessionText)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [Ctor])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { isSupported: Ctor !== null, isListening, start, stop }
}
