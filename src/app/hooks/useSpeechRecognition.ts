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
 * dictation (AI logging's mic button). Client-side only, free, zero extra
 * latency — no server audio pipeline. `isSupported` is false on browsers
 * without it (Firefox, most Safari), so callers can hide the mic button
 * entirely rather than show a broken affordance.
 */
export function useSpeechRecognition(onTranscript: (text: string) => void): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const Ctor = typeof window !== 'undefined' ? getSpeechRecognitionConstructor() : null

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Ctor || recognitionRef.current) return
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0]?.transcript ?? ''
      }
      if (finalText) onTranscriptRef.current(finalText)
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
