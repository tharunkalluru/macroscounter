import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { and, eq, gte, isNull } from 'drizzle-orm'
import { getUserId } from '../_auth.js'
import { getDb, schema } from '../_db.js'
import { computeAdaptiveAdjustment } from '../../src/domain/adaptive/adaptiveTargets.js'
import { computeKcalFloor } from '../../src/domain/goals/goalEngine.js'
import type { Targets } from '../../src/data/models.js'
import { deriveCurrentProgram } from '../../src/domain/programs/program.js'
import { groupEntriesByDate } from '../../src/domain/history/averages.js'
import { addDaysISO, todayISO } from '../../src/lib/date.js'

const MAX_MESSAGE_CHARS = 1000
const MAX_HISTORY_ITEMS = 20
const MAX_HISTORY_ITEM_CHARS = 2000
const HISTORY_WINDOW_DAYS = 14
const WEIGH_IN_WINDOW_DAYS = 30

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CoachChatRequestBody {
  message: string
  history?: ChatMessage[]
}

/** Pure validation, separated from the handler so it's unit-testable without a mock req/res. */
export function validateRequestBody(
  body: unknown
): { ok: true; value: CoachChatRequestBody } | { ok: false; error: string } {
  const b = body as Partial<CoachChatRequestBody> | null | undefined
  const message = typeof b?.message === 'string' ? b.message.trim() : ''
  if (!message) {
    return { ok: false, error: 'Message is required.' }
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, error: 'Message is too long.' }
  }

  const rawHistory = b?.history
  if (rawHistory !== undefined) {
    if (!Array.isArray(rawHistory) || rawHistory.length > MAX_HISTORY_ITEMS) {
      return { ok: false, error: 'Invalid conversation history.' }
    }
    for (const item of rawHistory) {
      if (
        !item ||
        (item.role !== 'user' && item.role !== 'assistant') ||
        typeof item.content !== 'string' ||
        item.content.length > MAX_HISTORY_ITEM_CHARS
      ) {
        return { ok: false, error: 'Invalid conversation history.' }
      }
    }
  }

  return { ok: true, value: { message, history: rawHistory as ChatMessage[] | undefined } }
}

/**
 * Assembles this user's current state from the server-side Postgres mirror
 * (not the client's own Dexie store, which this serverless function has no
 * access to) into the natural-language ground truth the system prompt
 * states as fact. Reuses the exact same pure domain functions the client
 * uses for its own program/adaptive-target displays, fed Postgres-sourced
 * rows instead of Dexie ones — they don't care where their inputs come from.
 */
async function buildUserContext(userId: string): Promise<string | null> {
  const db = getDb()
  const today = todayISO()

  const [profileRows, targetRows, weighInRows, logEntryRows] = await Promise.all([
    db
      .select()
      .from(schema.profiles)
      .where(and(eq(schema.profiles.userId, userId), isNull(schema.profiles.deletedAt)))
      .limit(1),
    db
      .select()
      .from(schema.targets)
      .where(and(eq(schema.targets.userId, userId), isNull(schema.targets.deletedAt))),
    db
      .select()
      .from(schema.weighIns)
      .where(
        and(
          eq(schema.weighIns.userId, userId),
          isNull(schema.weighIns.deletedAt),
          gte(schema.weighIns.date, addDaysISO(today, -(WEIGH_IN_WINDOW_DAYS - 1)))
        )
      ),
    db
      .select()
      .from(schema.logEntries)
      .where(
        and(
          eq(schema.logEntries.userId, userId),
          isNull(schema.logEntries.deletedAt),
          gte(schema.logEntries.date, addDaysISO(today, -(HISTORY_WINDOW_DAYS - 1)))
        )
      ),
  ])

  const profile = profileRows[0]
  if (!profile) return null

  const targets = targetRows.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  const latestTarget = targets[targets.length - 1]
  const program = targets.length > 0 ? deriveCurrentProgram(targets as unknown as Targets[], today) : null

  const weighIns = weighInRows
    .map((w) => ({ date: w.date, weightKg: w.weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const dailyTotals = groupEntriesByDate(logEntryRows)

  let adaptiveReason: string | null = null
  if (latestTarget) {
    const floorKcal = computeKcalFloor(
      profile.sex as 'male' | 'female',
      profile.weightKg,
      profile.heightCm,
      profile.age
    )
    const adaptive = computeAdaptiveAdjustment({
      loggedDays: dailyTotals.map((d) => ({ date: d.date, kcal: d.kcal })),
      weighIns,
      currentTargetKcal: latestTarget.kcal,
      floorKcal,
      referenceDate: today,
    })
    if (adaptive) adaptiveReason = adaptive.reason
  }

  const lines: string[] = []
  lines.push(`Name: ${profile.name}`)
  lines.push(`Sex: ${profile.sex}, age: ${profile.age}, height: ${profile.heightCm} cm, current weight: ${profile.weightKg} kg`)
  lines.push(`Goal: ${profile.goal}${profile.goalWeightKg ? `, target weight: ${profile.goalWeightKg} kg` : ''}`)
  if (profile.dietStyle) lines.push(`Diet style preference: ${profile.dietStyle}`)

  if (latestTarget) {
    lines.push(
      `Current daily targets: ${latestTarget.kcal} kcal, ${latestTarget.proteinG}g protein, ${latestTarget.carbsG}g carbs, ${latestTarget.fatG}g fat` +
        (latestTarget.fiberG ? `, ${latestTarget.fiberG}g fiber` : '')
    )
  } else {
    lines.push('No targets set yet.')
  }
  if (program) {
    lines.push(`Currently on week ${program.weekNumber} of their current program (${program.pastProgramsCount} past program(s) before this one).`)
  }
  if (adaptiveReason) {
    lines.push(`Adaptive target note: ${adaptiveReason}`)
  }

  if (dailyTotals.length > 0) {
    lines.push(`Logged intake, last ${dailyTotals.length} day(s) with data (most recent last):`)
    for (const d of dailyTotals) {
      lines.push(`  ${d.date}: ${Math.round(d.kcal)} kcal, ${d.p}g protein, ${d.c}g carbs, ${d.f}g fat`)
    }
  } else {
    lines.push(`No food logged in the last ${HISTORY_WINDOW_DAYS} days.`)
  }

  if (weighIns.length > 0) {
    const first = weighIns[0]
    const last = weighIns[weighIns.length - 1]
    lines.push(
      `Weigh-ins in the last ${WEIGH_IN_WINDOW_DAYS} days: ${weighIns.length} logged, from ${first.weightKg} kg on ${first.date} to ${last.weightKg} kg on ${last.date}.`
    )
  } else {
    lines.push(`No weigh-ins logged in the last ${WEIGH_IN_WINDOW_DAYS} days.`)
  }

  return lines.join('\n')
}

function buildSystemPrompt(userContext: string): string {
  return `You are this user's personal coach inside Bitewise, a calorie and macro tracking app. You have their real, current data below — treat it as ground truth, not something to ask them to repeat.

${userContext}

Answer the user's questions about their own nutrition, progress, and habits using this data — give honest, specific, personalized insight (what's going well, what to change, whether they're on track for their goal), grounded in the numbers above, not generic advice. If a question is unrelated to health, nutrition, fitness, or their own tracked data, politely decline and steer back to what you can actually help with. Keep answers conversational and concise — a few sentences, not an essay, unless the user is asking for a detailed breakdown.`
}

export async function chat(
  client: Anthropic,
  systemPrompt: string,
  body: CoachChatRequestBody
): Promise<string | null> {
  const messages: Anthropic.Messages.MessageParam[] = [
    ...(body.history ?? []).map((h) => ({ role: h.role, content: h.content }) satisfies Anthropic.Messages.MessageParam),
    { role: 'user' as const, content: body.message },
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages,
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock?.text ?? null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Sign in to talk to your coach.', code: 'not_signed_in' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'Coach chat is not configured yet.', code: 'missing_key' })
    return
  }

  const validated = validateRequestBody(req.body)
  if (!validated.ok) {
    res.status(400).json({ error: validated.error, code: 'invalid_input' })
    return
  }

  try {
    const userContext = await buildUserContext(userId)
    if (!userContext) {
      res.status(400).json({ error: 'Finish onboarding before using the coach chat.', code: 'no_profile' })
      return
    }

    const client = new Anthropic({ apiKey })
    const reply = await chat(client, buildSystemPrompt(userContext), validated.value)
    if (!reply) {
      res.status(502).json({ error: "Couldn't get a response - try again.", code: 'upstream_error' })
      return
    }
    res.status(200).json({ reply })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Too many requests - try again shortly.', code: 'rate_limited' })
      return
    }
    if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: "Couldn't get a response - try again.", code: 'upstream_error' })
      return
    }
    res.status(500).json({ error: "Couldn't get a response - try again.", code: 'upstream_error' })
  }
}
