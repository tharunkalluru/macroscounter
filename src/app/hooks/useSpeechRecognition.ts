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
 *
 * Two further bugs fixed here (both reproduced in the field, not just
 * theorized):
 *  - Some engines occasionally fire an interim result with an *empty*
 *    transcript (a silent/noise-only frame). The refinement check above,
 *    `prev.startsWith(latestText)`, is trivially true when `latestText` is
 *    `''` -- every string starts with the empty string -- so an empty
 *    result was replacing whatever had already been recognized for the
 *    current utterance with nothing, which read as "the mic just cleared
 *    my text." Empty transcripts are now ignored outright before they can
 *    touch either ref.
 *  - On restart, the previous version left the in-progress utterance
 *    sitting in `currentUtteranceRef` for the *next* recognition session's
 *    first result to be compared against -- but that session starts its
 *    own `results` array from index 0, recognizing audio that can
 *    genuinely overlap the tail end of what was already heard (the mic
 *    doesn't cut cleanly at the restart boundary). Comparing new audio
 *    against a different session's stale text produced duplicated words
 *    ("...belly fat fat" style repeats). The in-progress utterance is now
 *    committed and cleared *before* restarting, and every newly-started
 *    utterance is passed through `stripWordOverlap` against what's already
 *    committed so a re-heard trailing phrase gets deduplicated instead of
 *    doubled.
 */

/**
 * Removes a duplicated trailing/leading word run between two already-decided
 * pieces of text -- e.g. `stripWordOverlap('...reduce belly fat', 'belly fat
 * is high')` -> `'is high'`. Word-level and case-insensitive so it survives
 * minor re-recognition differences; capped at a short lookback since a real
 * overlap from a restart boundary is at most a couple of words, and a longer
 * accidental match is more likely coincidence than a genuine repeat.
 */
export function stripWordOverlap(existing: string, incoming: string): string {
  const existingWords = existing.trim().split(/\s+/).filter(Boolean)
  const incomingWords = incoming.trim().split(/\s+/).filter(Boolean)
  const maxOverlap = Math.min(existingWords.length, incomingWords.length, 6)
  for (let n = maxOverlap; n > 0; n--) {
    const tail = existingWords.slice(-n).join(' ').toLowerCase()
    const head = incomingWords.slice(0, n).join(' ').toLowerCase()
    if (tail === head) {
      return incomingWords.slice(n).join(' ')
    }
  }
  return incoming
}
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
      const latestText = (latest[0]?.transcript ?? '').trim()
      // A silent/noise-only frame carries no information -- letting it
      // through would trivially satisfy the "is this a refinement" check
      // below and wipe out whatever had already been recognized.
      if (!latestText) return
      const prev = currentUtteranceRef.current

      const isRefinement = prev !== '' && (latestText.startsWith(prev) || prev.startsWith(latestText))
      if (isRefinement) {
        currentUtteranceRef.current = latestText
      } else {
        if (prev) {
          committedTextRef.current += (committedTextRef.current ? ' ' : '') + prev
        }
        currentUtteranceRef.current = stripWordOverlap(committedTextRef.current, latestText)
      }

      const sessionText =
        committedTextRef.current +
        (committedTextRef.current && currentUtteranceRef.current ? ' ' : '') +
        currentUtteranceRef.current
      onLiveTranscriptRef.current(sessionText)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => {
      recognitionRef.current = null
      if (intentionalStopRef.current) {
        setIsListening(false)
        return
      }
      // The engine ended the session on its own, not the caller. Finalize
      // whatever was still mid-utterance into committed text *before*
      // restarting -- the new session starts its own results array from
      // scratch, so leaving it in currentUtteranceRef would compare newly
      // (and sometimes redundantly) recognized audio against a different
      // session's stale text instead of through the overlap check above.
      if (currentUtteranceRef.current) {
        committedTextRef.current += (committedTextRef.current ? ' ' : '') + currentUtteranceRef.current
        currentUtteranceRef.current = ''
      }
      beginRef.current()
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      // Some engines throw InvalidStateError when start() is called again
      // before the previous session has fully released -- surfacing as "the
      // mic just doesn't work" with no recovery. Drop back to a clean
      // stopped state instead of leaving isListening stuck true with a dead
      // recognition object underneath it.
      recognitionRef.current = null
      setIsListening(false)
    }
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
