import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { signIn, useSession } from '../lib/auth/authClient'
import { todayISO } from '../lib/date'
import {
  clearCoachSession,
  COACH_INTENTS,
  COACH_SESSION_MAX_MESSAGES,
  coachIntent,
  readCoachSession,
  writeCoachSession,
  type CoachChatMessage,
  type CoachIntent,
} from '../lib/ai/coachSession'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { CoachMessage, CoachUserMessage } from './components/CoachBubble'
import PageHeader from './components/PageHeader'
import { MicIcon, SparkleIcon } from './shell/icons'

const MAX_CHARS = 500
const MAX_HISTORY_SENT = 10

function errorMessageFor(code?: string): string {
  if (code === 'not_signed_in')
    return 'Your sign-in expired. Sign in again to continue; your question is kept in this tab.'
  if (code === 'missing_key')
    return 'Your coach is unavailable right now. Your diary and saved meals still work.'
  if (code === 'rate_limited') return 'AI is busy. Your question is saved here; try again shortly.'
  if (code === 'daily_limit')
    return 'You have reached today’s AI limit. It resets at midnight UTC. You can still search, scan barcodes and use saved meals.'
  if (code === 'no_profile')
    return 'Your profile has not reached your account yet. Finish setup and let your diary sync, then try again.'
  return 'Could not get a response. Your question is kept here so you can retry.'
}

export default function CoachChatPage() {
  const { data: session, isPending } = useSession()
  const [params] = useSearchParams()
  const intent = coachIntent(params.get('intent'))
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState(false)

  async function handleSignIn() {
    setSigningIn(true)
    setSignInError(false)
    try {
      const result = await signIn.social({
        provider: 'google',
        callbackURL: `/coach/chat${intent ? `?intent=${intent}` : ''}`,
      })
      if (result?.error) setSignInError(true)
    } catch {
      setSignInError(true)
    } finally {
      setSigningIn(false)
    }
  }

  if (isPending)
    return (
      <div role="status" className="flex min-h-[60vh] items-center justify-center text-slate-500">
        Loading your coach…
      </div>
    )
  if (!session)
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-md flex-col px-6 py-6">
        <PageHeader title="Ask your coach" backTo="/coach" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
            <SparkleIcon className="h-8 w-8" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            A little guidance for your day
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Sign in for meal ideas and practical next steps based on your synced diary.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            data-testid="coach-chat-signin-button"
            className="mt-2 min-h-touch rounded-card bg-brand-700 px-5 py-2.5 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {signingIn ? 'Opening sign-in…' : 'Continue with Google'}
          </button>
          <Link
            to="/welcome"
            data-testid="coach-chat-signin-other-options"
            className="inline-flex min-h-touch items-center text-sm text-brand-700 underline dark:text-brand-400"
          >
            Use a password or email code instead
          </Link>
          {signInError && (
            <p role="alert" className="text-sm text-danger-600 dark:text-danger-500">
              Could not open sign-in. Please try again.
            </p>
          )}
        </div>
      </div>
    )
  // Remount immediately on account changes, so another account never sees this transcript.
  return <CoachConversation key={session.user.id} userId={session.user.id} intent={intent} />
}

function CoachConversation({ userId, intent }: { userId: string; intent: CoachIntent | null }) {
  const [initial] = useState(() => readCoachSession(userId))
  const [messages, setMessages] = useState<CoachChatMessage[]>(initial.messages)
  const [input, setInput] = useState(initial.draft || (intent ? COACH_INTENTS[intent].prompt : ''))
  const [failedQuestion, setFailedQuestion] = useState<string | null>(initial.failedQuestion)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(
    initial.failedQuestion ? 'Your last question did not finish. You can retry it below.' : null
  )
  const requestRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const inputBeforeListeningRef = useRef('')
  const {
    isSupported: micSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition((sessionText) => {
    const base = inputBeforeListeningRef.current
    setInput(`${base}${base && sessionText ? ' ' : ''}${sessionText}`.slice(0, MAX_CHARS))
  })

  useEffect(() => {
    writeCoachSession(userId, { messages, draft: input, failedQuestion })
  }, [userId, messages, input, failedQuestion])
  useEffect(
    () => () => {
      const request = requestRef.current
      requestRef.current = null
      request?.abort()
    },
    []
  )
  useEffect(() => {
    const transcript = transcriptRef.current
    if (transcript) transcript.scrollTop = transcript.scrollHeight
  }, [messages, sending, error])

  function selectIntent(selected: CoachIntent) {
    setInput(COACH_INTENTS[selected].prompt)
    textareaRef.current?.focus()
  }

  async function send(question = input) {
    const message = question.trim()
    if (!message || sendingRef.current) return
    sendingRef.current = true
    if (isListening) stopListening()
    const prior =
      failedQuestion &&
      messages.at(-1)?.role === 'user' &&
      messages.at(-1)?.content === failedQuestion
        ? messages.slice(0, -1)
        : messages
    const next: CoachChatMessage[] = [...prior, { role: 'user', content: message }].slice(
      -COACH_SESSION_MAX_MESSAGES
    ) as CoachChatMessage[]
    const controller = new AbortController()
    requestRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 100000)
    setMessages(next)
    setInput('')
    setFailedQuestion(message)
    setError(null)
    setSending(true)
    let failureMessage: string | null = null
    try {
      const response = await fetch('/api/ai/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          history: prior
            .slice(-MAX_HISTORY_SENT)
            .map((m) => ({ ...m, content: m.content.slice(0, 2000) })),
          localDate: todayISO(),
        }),
      })
      const json = (await response.json()) as { reply?: unknown; code?: string }
      if (!response.ok) {
        failureMessage = errorMessageFor(json.code)
        throw new Error('Request failed')
      }
      if (typeof json.reply !== 'string' || !json.reply.trim()) throw new Error(errorMessageFor())
      if (controller.signal.aborted) return
      setMessages(
        [...next, { role: 'assistant', content: json.reply.trim().slice(0, 6000) }].slice(
          -COACH_SESSION_MAX_MESSAGES
        ) as CoachChatMessage[]
      )
      setFailedQuestion(null)
    } catch {
      if (requestRef.current === controller) setError(failureMessage ?? errorMessageFor())
    } finally {
      window.clearTimeout(timeout)
      sendingRef.current = false
      if (requestRef.current === controller) {
        requestRef.current = null
        setSending(false)
      }
    }
  }

  function clearConversation() {
    if (sendingRef.current) return
    clearCoachSession(userId)
    setMessages([])
    setInput('')
    setError(null)
    setFailedQuestion(null)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-2xl flex-col px-5 py-5 lg:min-h-[calc(100dvh-8rem)] lg:px-8">
      <PageHeader title="Ask your coach" backTo="/coach" />
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-caption text-slate-500 dark:text-slate-400">
          Your diary. A useful next step.
        </p>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            disabled={sending}
            className="min-h-touch text-caption font-medium text-slate-500 disabled:opacity-50 dark:text-slate-400"
            data-testid="coach-chat-clear"
          >
            New conversation
          </button>
        )}
      </div>
      <div
        ref={transcriptRef}
        role="log"
        aria-label="Conversation with your AI coach"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={sending}
        className="flex max-h-[55dvh] min-h-48 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain py-2"
        data-testid="coach-chat-messages"
      >
        {messages.length === 0 && (
          <>
            <CoachMessage testId="coach-chat-intro">
              Let’s make your next step easier. I can help with meal ideas, patterns in your diary,
              or a routine that fits your life.
            </CoachMessage>
            <div className="my-3 grid gap-2 sm:grid-cols-3">
              {(
                Object.entries(COACH_INTENTS) as [
                  CoachIntent,
                  (typeof COACH_INTENTS)[CoachIntent],
                ][]
              ).map(([id, item]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectIntent(id)}
                  data-testid={`coach-intent-${id}`}
                  className={`min-h-touch rounded-card border p-4 text-left transition-transform active:scale-[0.98] ${intent === id ? 'border-brand-300 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-surface-dark-card'}`}
                >
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-caption text-slate-500 dark:text-slate-400">
                    {item.detail}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <CoachUserMessage key={index} testId={`coach-chat-message-${index}`}>
              <span className="sr-only">You: </span>
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            </CoachUserMessage>
          ) : (
            <CoachMessage key={index} testId={`coach-chat-message-${index}`}>
              <span className="sr-only">Coach: </span>
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            </CoachMessage>
          )
        )}
        {sending && (
          <CoachMessage testId="coach-chat-thinking">Looking at your synced diary…</CoachMessage>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="mt-3 rounded-card border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-900/20 dark:text-danger-300"
        >
          <p data-testid="coach-chat-error">{error}</p>
          {failedQuestion && !sending && (
            <button
              type="button"
              onClick={() => send(failedQuestion)}
              className="mt-1 min-h-touch font-semibold underline"
              data-testid="coach-chat-retry"
            >
              Retry this question
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
        className="mt-auto pt-5"
      >
        <label htmlFor="coach-question" className="sr-only">
          Ask your coach
        </label>
        <div className="rounded-card border border-slate-200 bg-white p-2 shadow-card dark:border-slate-800 dark:bg-surface-dark-card">
          <textarea
            id="coach-question"
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send()
              }
            }}
            placeholder="What would help you today?"
            rows={3}
            maxLength={MAX_CHARS}
            data-testid="coach-chat-input"
            className="min-h-touch w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-base text-slate-900 outline-none dark:text-slate-100"
          />
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              {micSupported && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    if (isListening) stopListening()
                    else {
                      inputBeforeListeningRef.current = input
                      startListening()
                    }
                  }}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={isListening}
                  data-testid="coach-chat-mic-button"
                  className={`flex min-h-touch min-w-touch items-center justify-center rounded-xl ${isListening ? 'bg-danger-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <MicIcon active={isListening} />
                </button>
              )}
              <span className="text-caption tabular-nums text-slate-400">
                {input.length}/{MAX_CHARS}
              </span>
            </div>
            <button
              type="submit"
              disabled={!input.trim() || sending}
              data-testid="coach-chat-send-button"
              className="min-h-touch rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {sending ? 'Thinking…' : 'Send'}
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-caption leading-relaxed text-slate-500 dark:text-slate-400">
          AI uses your synced profile and diary. Logs may be incomplete. Conversation stays in this
          tab for up to 24 hours; general guidance, not medical advice.
        </p>
      </form>
    </div>
  )
}
