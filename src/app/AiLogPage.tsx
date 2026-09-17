import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import type { FoodItemResult } from '../../api/ai/analyze'
import { signIn, useSession } from '../lib/auth/authClient'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { compressImageFile } from '../lib/ai/imageCompress'
import { diaryDate, diaryPath, todayISO } from '../lib/date'
import PageHeader from './components/PageHeader'
import { CameraIcon, MicIcon, SparkleIcon } from './shell/icons'

const MAX_CHARS = 900
const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks']
const EXAMPLES = [
  '2 idlis with a small bowl of sambar',
  'A chicken sandwich with a little mayo',
  '200 g Greek yogurt and a banana',
]

interface AnalyzeErrorResponse {
  error: string
  code?:
    | 'not_signed_in'
    | 'missing_key'
    | 'invalid_input'
    | 'rate_limited'
    | 'daily_limit'
    | 'upstream_error'
}

function errorMessageFor(code: AnalyzeErrorResponse['code']): string {
  if (code === 'not_signed_in')
    return 'Your sign-in expired - reload and sign in again to keep using AI logging.'
  if (code === 'missing_key') return "AI logging isn't set up yet - search or scan instead."
  if (code === 'rate_limited') return 'Too many requests - try again in a moment.'
  if (code === 'daily_limit')
    return 'Your AI allowance is used for today. You can keep logging with food search or quick add.'
  return "Couldn't analyse that - try again, or log it manually."
}

export default function AiLogPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMeal = searchParams.get('meal') as Meal
  const meal = MEALS.includes(requestedMeal) ? requestedMeal : 'breakfast'
  const entryDate = diaryDate(searchParams.get('date'))
  const isToday = entryDate === todayISO()
  const dateSuffix = isToday ? '' : `&date=${entryDate}`
  const manualPath = `/log/add?meal=${meal}&date=${entryDate}`
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<{ file: Blob; previewUrl: string } | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const { data: session, isPending: sessionPending } = useSession()
  const descriptionBeforeListeningRef = useRef('')
  const {
    isSupported: micSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition((sessionText) => {
    const base = descriptionBeforeListeningRef.current
    setDescription(`${base}${base && sessionText ? ' ' : ''}${sessionText}`.slice(0, MAX_CHARS))
  })

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl)
    },
    [photo]
  )
  useEffect(() => () => requestRef.current?.abort(), [])

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
    setError(null)
    try {
      const result = await signIn.social({
        provider: 'google',
        callbackURL: `/log/ai?meal=${meal}${dateSuffix}`,
      })
      if (result.error)
        setError('Could not open sign-in. Please try again or choose another sign-in option.')
    } catch {
      setError('Could not open sign-in. Please check your connection and try again.')
    } finally {
      setSigningIn(false)
    }
  }

  function handlePhotoSelected(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo of your meal.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Choose a photo smaller than 20 MB.')
      return
    }
    setError(null)
    setPhoto({ file, previewUrl: URL.createObjectURL(file) })
  }

  function removePhoto() {
    setPhoto(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAnalyse() {
    if (busyRef.current || (!description.trim() && !photo)) return
    busyRef.current = true
    if (isListening) stopListening()
    setError(null)
    setAnalysing(true)
    const controller = new AbortController()
    requestRef.current = controller
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 60000)
    try {
      const image = photo ? await compressImageFile(photo.file) : undefined
      if (controller.signal.aborted) throw new Error('aborted')
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || undefined, image }),
        signal: controller.signal,
      })
      const json = (await res.json()) as { items?: FoodItemResult[] } & AnalyzeErrorResponse
      if (!res.ok) {
        setError(errorMessageFor(json.code))
        return
      }
      if (!Array.isArray(json.items)) {
        setError(errorMessageFor(undefined))
        return
      }
      navigate('/log/ai/result', {
        state: { meal, date: entryDate, items: json.items, photo: image },
      })
    } catch {
      if (timedOut)
        setError(
          'This is taking longer than expected. Your meal has not been logged. Try again or use food search.'
        )
      else if (!controller.signal.aborted) setError(errorMessageFor(undefined))
    } finally {
      window.clearTimeout(timeout)
      busyRef.current = false
      if (requestRef.current === controller) requestRef.current = null
      setAnalysing(false)
    }
  }

  if (sessionPending)
    return (
      <main className="mx-auto max-w-md px-6 py-12 text-slate-500 dark:text-slate-400">
        <p role="status">Getting your account ready…</p>
      </main>
    )

  if (!session) {
    return (
      <main className="mx-auto max-w-lg px-5 py-6">
        <PageHeader title="Log with AI" backTo={diaryPath(entryDate)} />
        <section className="rounded-card bg-white p-7 text-center shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-brand-400">
            <SparkleIcon className="h-7 w-7" />
          </span>
          <h2 className="text-title text-slate-900 dark:text-slate-100">
            Sign in to use AI logging
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Describe your meal, speak it, or share a photo. Review the estimate and make it yours
            before saving.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            data-testid="ai-signin-button"
            className="pressable mt-6 min-h-touch w-full rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {signingIn ? 'Opening sign-in…' : 'Continue with Google'}
          </button>
          <Link
            to="/welcome"
            data-testid="ai-signin-other-options"
            className="mt-2 inline-flex min-h-touch items-center text-sm font-medium text-brand-700 dark:text-brand-400"
          >
            Use a password or email code instead
          </Link>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger-700 dark:text-danger-300">
              {error}
            </p>
          )}
        </section>
        <Link
          to={manualPath}
          className="mt-3 flex min-h-touch items-center justify-center text-sm text-slate-600 dark:text-slate-300"
        >
          Continue with food search →
        </Link>
      </main>
    )
  }

  const canAnalyse = (description.trim().length > 0 || photo !== null) && !analysing

  return (
    <main className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <PageHeader title="Log with AI" backTo={diaryPath(entryDate)} />
      <div className="mb-6">
        <p className="text-caption font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-400">
          Less searching, more living
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          What did you have?
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          A few words, a photo, or both. You get the final say.
        </p>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0 rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-caption">
            <span className="rounded-full bg-brand-50 px-3 py-1.5 font-medium capitalize text-brand-700 dark:bg-slate-800 dark:text-brand-400">
              {meal}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {isToday
                ? 'Today'
                : new Date(`${entryDate}T12:00:00`).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
            </span>
            <span className="text-slate-400">Change on review</span>
          </div>
          <label
            htmlFor="meal-description"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Describe your meal
          </label>
          <div className="relative mt-2">
            <textarea
              id="meal-description"
              value={description}
              disabled={analysing}
              onChange={(event) => setDescription(event.target.value.slice(0, MAX_CHARS))}
              placeholder="Two rotis, a bowl of dal and a little rice. Cooked with about a teaspoon of oil."
              rows={5}
              data-testid="ai-description-input"
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 pr-14 text-body leading-relaxed text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {micSupported && (
              <button
                type="button"
                disabled={analysing}
                onClick={handleMicClick}
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={isListening}
                data-testid="ai-mic-button"
                className={`pressable absolute right-2 top-2 flex min-h-touch min-w-touch items-center justify-center rounded-xl ${isListening ? 'bg-danger-600 text-white' : 'bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300'}`}
              >
                <MicIcon active={isListening} />
              </button>
            )}
          </div>
          <div className="mt-1 flex min-h-5 justify-between gap-3 text-caption text-slate-500 dark:text-slate-400">
            <span role="status">
              {isListening
                ? 'Listening… tap the microphone when you’re done.'
                : 'Amounts and cooking details help.'}
            </span>
            <span className="shrink-0 tabular-nums">
              {description.length}/{MAX_CHARS}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => handlePhotoSelected(event.target.files?.[0])}
            data-testid="ai-photo-input"
            className="hidden"
          />
          {photo ? (
            <div
              className="mt-5 flex items-center gap-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              data-testid="ai-photo-preview"
            >
              <img
                src={photo.previewUrl}
                alt="Selected meal"
                className="h-20 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Photo ready
                </p>
                <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
                  Add details above for anything the camera can't see.
                </p>
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={analysing}
                  aria-label="Remove photo"
                  data-testid="ai-photo-remove"
                  className="min-h-touch text-caption font-medium text-brand-700 dark:text-brand-400"
                >
                  Remove photo
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={analysing}
              data-testid="ai-photo-add"
              className="pressable mt-5 flex min-h-touch w-full items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-4 text-left dark:border-slate-600 dark:bg-slate-800/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 dark:bg-slate-800 dark:text-brand-400">
                <CameraIcon />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Add a meal photo
                </span>
                <span className="mt-0.5 block text-caption text-slate-500 dark:text-slate-400">
                  Take a photo or choose one from your library
                </span>
              </span>
            </button>
          )}
          {error && (
            <p
              role="alert"
              data-testid="ai-error-message"
              className="mt-4 rounded-xl bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-900/20 dark:text-danger-300"
            >
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={!canAnalyse}
            data-testid="ai-analyse-button"
            className="pressable mt-5 flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            <SparkleIcon className="h-4 w-4" />
            {analysing ? 'Putting your meal together…' : 'Analyse this meal'}
          </button>
          <p className="mt-3 text-center text-caption text-slate-500 dark:text-slate-400">
            You can edit every item before logging.
          </p>
        </section>
        <aside className="space-y-5">
          <div className="rounded-card bg-brand-50 p-5 dark:bg-slate-900">
            <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">
              Your meal, your control
            </p>
            <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {[
                'Describe or photograph your food.',
                'Review portions and nutrition.',
                'Save to the right day and meal.',
              ].map((text, index) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-caption font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-400">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-brand-100 pt-4 text-caption leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
              AI estimates portions and nutrition. It cannot reliably see hidden ingredients, so
              always check the result.
            </p>
          </div>
          <div>
            <h3 className="text-caption font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Try a description
            </h3>
            <div className="mt-2 flex flex-col gap-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setDescription(example)}
                  disabled={analysing}
                  className="min-h-touch rounded-lg px-2 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {example} <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
          <Link
            to={manualPath}
            className="flex min-h-touch items-center text-sm font-medium text-brand-700 dark:text-brand-400"
          >
            Prefer food search? Find it here →
          </Link>
        </aside>
      </div>
    </main>
  )
}
