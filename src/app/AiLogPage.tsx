import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import type { FoodItemResult } from '../../api/ai/analyze'
import { signIn, useSession } from '../lib/auth/authClient'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { compressImageFile } from '../lib/ai/imageCompress'
import PageHeader from './components/PageHeader'
import { CameraIcon, MicIcon, SparkleIcon } from './shell/icons'

const MAX_CHARS = 500

interface AnalyzeErrorResponse {
  error: string
  code?: 'not_signed_in' | 'missing_key' | 'invalid_input' | 'rate_limited' | 'upstream_error'
}

function errorMessageFor(code: AnalyzeErrorResponse['code']): string {
  if (code === 'not_signed_in') return 'Your sign-in expired - reload and sign in again to keep using AI logging.'
  if (code === 'missing_key') return "AI logging isn't set up yet - search or scan instead."
  if (code === 'rate_limited') return 'Too many requests - try again in a moment.'
  return "Couldn't analyse that - try again, or log it manually."
}

/**
 * Real AI logging: type, dictate, and/or photograph a meal in one screen —
 * Claude estimates calories/macros from whatever's provided, sent to
 * /api/ai/analyze (server-side, keyed by ANTHROPIC_API_KEY).
 */
export default function AiLogPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const meal = (searchParams.get('meal') as Meal) ?? 'breakfast'
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<{ file: Blob; previewUrl: string } | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: session, isPending: sessionPending } = useSession()

  // Snapshot of the textarea's contents from just before the mic was
  // started -- the hook reports the *full* cumulative transcript for the
  // current listening session on every update (see its own doc comment),
  // so each update replaces (not appends to) whatever came before this
  // session started, rather than compounding on every partial result.
  const descriptionBeforeListeningRef = useRef('')
  const { isSupported: micSupported, isListening, start: startListening, stop: stopListening } =
    useSpeechRecognition((sessionText) => {
      const base = descriptionBeforeListeningRef.current
      setDescription(`${base}${base && sessionText ? ' ' : ''}${sessionText}`.slice(0, MAX_CHARS))
    })

  function handleMicClick() {
    if (isListening) {
      stopListening()
      return
    }
    descriptionBeforeListeningRef.current = description
    startListening()
  }

  async function handleSignIn() {
    setSigningIn(true)
    await signIn.social({ provider: 'google', callbackURL: `/log/ai?meal=${meal}` })
  }

  if (sessionPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  if (!session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
        <PageHeader title="Describe or snap" backTo="/" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <SparkleIcon className="h-8 w-8 text-brand-600 dark:text-brand-400" />
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sign in to use AI logging</p>
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
            AI-powered photo, voice, and text logging is available for signed-in accounts.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            data-testid="ai-signin-button"
            className="mt-2 min-h-touch rounded-card bg-brand-700 px-5 py-2.5 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return
    setPhoto({ file, previewUrl: URL.createObjectURL(file) })
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    setPhoto(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAnalyse() {
    if (isListening) stopListening()
    setError(null)
    setAnalysing(true)
    try {
      const image = photo ? await compressImageFile(photo.file) : undefined
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || undefined, image }),
      })
      const json = (await res.json()) as { items?: FoodItemResult[] } & AnalyzeErrorResponse
      if (!res.ok) {
        setError(errorMessageFor(json.code))
        return
      }
      navigate('/log/ai/result', { state: { meal, items: json.items ?? [] } })
    } catch {
      setError(errorMessageFor(undefined))
    } finally {
      setAnalysing(false)
    }
  }

  const canAnalyse = (description.trim().length > 0 || photo !== null) && !analysing

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <PageHeader title="Describe or snap" backTo="/" />

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_CHARS))}
            placeholder="e.g. 100g grilled chicken breast with 50g grilled chicken thigh"
            rows={5}
            data-testid="ai-description-input"
            className="min-h-touch w-full rounded-card border border-slate-300 p-3 pr-14 text-sm dark:border-slate-600 dark:bg-surface-dark-card dark:text-slate-100"
          />
          {micSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
              data-testid="ai-mic-button"
              className={`absolute right-2 top-2 flex min-h-touch min-w-touch items-center justify-center rounded-full transition-colors ${
                isListening
                  ? 'bg-danger-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              <MicIcon active={isListening} />
            </button>
          )}
        </div>
        <span className="self-end text-caption text-slate-500 dark:text-slate-400">
          {description.length}/{MAX_CHARS}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
        data-testid="ai-photo-input"
        className="hidden"
      />

      {photo ? (
        <div className="relative mt-3 aspect-square w-full max-w-[160px]" data-testid="ai-photo-preview">
          <img src={photo.previewUrl} alt="Selected meal" className="h-full w-full rounded-card object-cover" />
          <button
            type="button"
            onClick={removePhoto}
            aria-label="Remove photo"
            data-testid="ai-photo-remove"
            className="absolute -right-2 -top-2 flex min-h-touch min-w-touch items-center justify-center rounded-full bg-slate-900/80 text-white"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="ai-photo-add"
          className="mt-3 flex aspect-square w-full max-w-[160px] flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400"
        >
          <CameraIcon />
          <span className="text-caption">Add photo</span>
        </button>
      )}

      <div className="mt-4 flex gap-3 rounded-card border border-slate-200 p-3.5 dark:border-slate-700">
        <SparkleIcon className="mt-0.5 flex-none text-brand-600 dark:text-brand-400" />
        <p className="text-caption leading-relaxed text-slate-500 dark:text-slate-400">
          Estimated by AI from what you typed, said, or showed it -{' '}
          <strong className="font-medium text-slate-600 dark:text-slate-300">always check before logging.</strong>
        </p>
      </div>

      {error && (
        <p role="alert" data-testid="ai-error-message" className="mt-3 text-sm text-danger-600 dark:text-danger-500">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleAnalyse}
        disabled={!canAnalyse}
        data-testid="ai-analyse-button"
        className="mt-auto min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {analysing ? 'Analysing…' : 'Analyse this meal'}
      </button>
    </div>
  )
}
