import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCoachSession,
  COACH_SESSION_MAX_MESSAGES,
  COACH_SESSION_TTL,
  coachIntent,
  readCoachSession,
  writeCoachSession,
  type CoachSession,
} from './coachSession'

const now = Date.UTC(2026, 8, 16)
const example: CoachSession = {
  messages: [
    { role: 'user', content: 'A question' },
    { role: 'assistant', content: 'An answer' },
  ],
  draft: 'Next question',
  failedQuestion: null,
}
const stored = new Map<string, string>()
const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => {
    stored.set(key, value)
  },
  removeItem: (key: string) => {
    stored.delete(key)
  },
}
beforeEach(() => stored.clear())

describe('coach conversation retention', () => {
  it('restores a conversation and draft in the same account only', () => {
    writeCoachSession('a', example, storage, now)
    expect(readCoachSession('a', storage, now)).toEqual(example)
    expect(readCoachSession('b', storage, now).messages).toEqual([])
    expect(readCoachSession('', storage, now).messages).toEqual([])
  })
  it('expires transcripts after 24 hours and rejects future timestamps', () => {
    writeCoachSession('a', example, storage, now)
    expect(readCoachSession('a', storage, now + COACH_SESSION_TTL).messages).toEqual([])
    expect(stored.size).toBe(0)
    writeCoachSession('a', example, storage, now + 1)
    expect(readCoachSession('a', storage, now).messages).toEqual([])
  })
  it('retains a failed question for retry and bounds long conversations', () => {
    writeCoachSession(
      'a',
      {
        ...example,
        messages: Array.from({ length: 35 }, (_, i) => ({
          role: 'user' as const,
          content: String(i),
        })),
        failedQuestion: 'Retry me',
      },
      storage,
      now
    )
    const saved = readCoachSession('a', storage, now)
    expect(saved.messages).toHaveLength(COACH_SESSION_MAX_MESSAGES)
    expect(saved.messages[0].content).toBe('15')
    expect(saved.failedQuestion).toBe('Retry me')
  })
  it('clears only the current account and fails safely when storage is blocked', () => {
    writeCoachSession('a', example, storage, now)
    writeCoachSession('b', example, storage, now)
    clearCoachSession('a', storage)
    expect(readCoachSession('a', storage, now).messages).toEqual([])
    expect(readCoachSession('b', storage, now)).toEqual(example)
    const blocked = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    }
    expect(readCoachSession('a', blocked, now).messages).toEqual([])
    expect(() => writeCoachSession('a', example, blocked, now)).not.toThrow()
  })
  it('rejects broken stored data and unrecognized starter intents', () => {
    storage.setItem('bitewise:coach:v1:a', 'bad json')
    expect(readCoachSession('a', storage, now).messages).toEqual([])
    expect(coachIntent('next-meal')).toBe('next-meal')
    expect(coachIntent('constructor')).toBeNull()
    expect(coachIntent('bad')).toBeNull()
  })
})
