import { useRef, useState } from 'react'
import { signIn, useSession } from '../lib/auth/authClient'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { CoachMessage, CoachUserMessage } from './components/CoachBubble'
import PageHeader from './components/PageHeader'
import { MicIcon, SparkleIcon } from './shell/icons'

const MAX_CHARS = 500
// Caps how much prior conversation rides along on each request -- enough
// for the coach to follow a short back-and-forth without the request body
// (and Claude's context) growing unbounded over a long session.
const MAX_HISTORY_SENT = 10

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatErrorResponse {
  error: string
  code?: 'not_signed_in' | 'missing_key' | 'invalid_input' | 'rate_limited' | 'upstream_error' | 'no_profile'
}

function errorMessageFor(code: ChatErrorResponse['code']): string {
  if (code === 'not_signed_in') return 'Your sign-in expired - reload and sign in again to keep chatting with your coach.'
  if (code === 'missing_key') return "Coach chat isn't set up yet."
  if (code === 'rate_limited') return 'Too many requests - try again in a moment.'
  if (code === 'no_profile') return 'Finish onboarding first so your coach has something to go on.'
  return "Couldn't get a response - try again."
}

/**
 * The Coach tab's headline feature: a free-text chat grounded in this user's
 * own profile/targets/logged history, via /api/ai/coach-chat (server-side,
 * keyed by the same ANTHROPIC_API_KEY as AI food logging). Conversation
 * history is session-only -- it resets when this screen is left, matching
 * v1 scope (no new Dexie store/sync surface for it yet).
 */
export default function CoachChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const { data: session, isPending: sessionPending } = useSession()

  // Same snapshot-before-listening + live cumulative-transcript pattern as
  // AiLogPage's mic input (see useSpeechRecognition's own doc comment).
  const inputBeforeListeningRef = useRef('')
  const { isSupported: micSupported, isListening, start: startListening, stop: stopListening } =
    useSpeechRecognition((sessionText) => {
      const base = inputBeforeListeningRef.current
      setInput(`${base}${base && sessionText ? ' ' : ''}${sessionText}`.slice(0, MAX_CHARS))
    })

  function handleMicClick() {
    if (isListening) {
      stopListening()
      return
    }
    inputBeforeListeningRef.current = input
    startListening()
  }

  async function handleSignIn() {
    setSigningIn(true)
    await signIn.social({ provider: 'google', callbackURL: '/coach/chat' })
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
        <PageHeader title="Ask your coach" backTo="/coach" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <SparkleIcon className="h-8 w-8 text-brand-600 dark:text-brand-400" />
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sign in to chat with your coach</p>
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Personalized answers grounded in your own logged data are available for signed-in accounts.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            data-testid="coach-chat-signin-button"
            className="mt-2 min-h-touch rounded-card bg-brand-700 px-5 py-2.5 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  async function handleSend() {
    const message = input.trim()
    if (!message || sending) return
    if (isListening) stopListening()

    setError(null)
    setInput('')
    const priorMessages = messages
    setMessages((m) => [...m, { role: 'user', content: message }])
    setSending(true)
    try {
      const res = await fetch('/api/ai/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: priorMessages.slice(-MAX_HISTORY_SENT) }),
      })
      const json = (await res.json()) as { reply?: string } & ChatErrorResponse
      if (!res.ok) {
        setError(errorMessageFor(json.code))
        return
      }
      setMessages((m) => [...m, { role: 'assistant', content: json.reply ?? '' }])
    } catch {
      setError(errorMessageFor(undefined))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <PageHeader title="Ask your coach" backTo="/coach" />

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-3" data-testid="coach-chat-messages">
        {messages.length === 0 && (
          <CoachMessage testId="coach-chat-intro">
            Ask me anything about your progress, targets, or habits - I can see your logged data and give you a
            straight answer.
          </CoachMessage>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <CoachUserMessage key={i} testId={`coach-chat-message-${i}`}>
              {m.content}
            </CoachUserMessage>
          ) : (
            <CoachMessage key={i} testId={`coach-chat-message-${i}`}>
              {m.content}
            </CoachMessage>
          )
        )}
        {sending && <CoachMessage testId="coach-chat-thinking">Thinking…</CoachMessage>}
      </div>

      {error && (
        <p role="alert" data-testid="coach-chat-error" className="mb-2 text-sm text-danger-600 dark:text-danger-500">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <div className="relative flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask a question…"
            rows={1}
            data-testid="coach-chat-input"
            className="min-h-touch w-full rounded-card border border-slate-300 p-3 pr-12 text-sm dark:border-slate-600 dark:bg-surface-dark-card dark:text-slate-100"
          />
          {micSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
              data-testid="coach-chat-mic-button"
              className={`absolute right-2 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-full transition-colors ${
                isListening
                  ? 'bg-danger-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              <MicIcon active={isListening} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          data-testid="coach-chat-send-button"
          className="min-h-touch shrink-0 rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
