import { normalizeCoachReply } from './coachReply'

export interface CoachChatMessage {
  role: 'user' | 'assistant'
  content: string
}
export interface CoachSession {
  messages: CoachChatMessage[]
  draft: string
  failedQuestion: string | null
}

export const COACH_SESSION_MAX_MESSAGES = 20
export const COACH_SESSION_TTL = 24 * 60 * 60 * 1000
const PREFIX = 'bitewise:coach:v1:'
const emptySession = (): CoachSession => ({ messages: [], draft: '', failedQuestion: null })
const keyFor = (userId: string) => `${PREFIX}${encodeURIComponent(userId)}`

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readCoachSession(
  userId: string,
  storage?: SessionStore,
  now = Date.now()
): CoachSession {
  if (!userId) return emptySession()
  try {
    const store = storage ?? window.sessionStorage
    const raw = store.getItem(keyFor(userId))
    if (!raw) return emptySession()
    const data = JSON.parse(raw)
    if (
      !Number.isFinite(data.updatedAt) ||
      now - data.updatedAt >= COACH_SESSION_TTL ||
      data.updatedAt > now ||
      !Array.isArray(data.messages)
    ) {
      store.removeItem(keyFor(userId))
      return emptySession()
    }
    const messages: CoachChatMessage[] = data.messages
      .filter((m: unknown): m is CoachChatMessage => {
        if (!m || typeof m !== 'object') return false
        const value = m as Partial<CoachChatMessage>
        return (
          (value.role === 'user' || value.role === 'assistant') &&
          typeof value.content === 'string' &&
          value.content.length > 0 &&
          value.content.length <= 6000
        )
      })
      .slice(-COACH_SESSION_MAX_MESSAGES)
      .map((message: CoachChatMessage) => ({
        ...message,
        content:
          message.role === 'assistant' ? normalizeCoachReply(message.content) : message.content,
      }))
    return {
      messages,
      draft: typeof data.draft === 'string' ? data.draft.slice(0, 500) : '',
      failedQuestion:
        typeof data.failedQuestion === 'string' && data.failedQuestion.length <= 500
          ? data.failedQuestion
          : null,
    }
  } catch {
    return emptySession()
  }
}

export function writeCoachSession(
  userId: string,
  data: CoachSession,
  storage?: SessionStore,
  now = Date.now()
): void {
  if (!userId) return
  try {
    const store = storage ?? window.sessionStorage
    store.setItem(
      keyFor(userId),
      JSON.stringify({
        updatedAt: now,
        messages: data.messages
          .slice(-COACH_SESSION_MAX_MESSAGES)
          .map((message) => ({ ...message, content: message.content.slice(0, 6000) })),
        draft: data.draft.slice(0, 500),
        failedQuestion: data.failedQuestion?.slice(0, 500) ?? null,
      })
    )
  } catch {
    // Storage can be unavailable in private browsing; chatting still works.
  }
}

export function clearCoachSession(userId: string, storage?: SessionStore): void {
  try {
    ;(storage ?? window.sessionStorage).removeItem(keyFor(userId))
  } catch {
    /* Optional tab retention. */
  }
}

export const COACH_INTENTS = {
  'next-meal': {
    title: 'Meal ideas',
    detail: 'A few ideas that fit my day',
    prompt:
      'What could I eat next? Suggest a few practical options using my goals and what I have logged today. Remember my diary may be incomplete.',
  },
  'week-review': {
    title: 'My week',
    detail: 'Find one useful pattern',
    prompt:
      'Review my past week of logged meals and give me one manageable next step. Please distinguish incomplete records from actual intake.',
  },
  simplify: {
    title: 'Log faster',
    detail: 'Build a routine I can keep',
    prompt:
      'How can I make food logging easier to keep up with? Use my recent meals and suggest a small repeatable routine in Bitewise.',
  },
} as const

export type CoachIntent = keyof typeof COACH_INTENTS
export function coachIntent(value: string | null): CoachIntent | null {
  return value && Object.prototype.hasOwnProperty.call(COACH_INTENTS, value)
    ? (value as CoachIntent)
    : null
}
