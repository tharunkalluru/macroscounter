import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../drizzle/schema'

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined

/** Lazily-created Drizzle client over Neon's HTTP driver — safe to call per-request in a serverless function. */
export function getDb() {
  if (!cached) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set')
    }
    cached = drizzle(neon(databaseUrl), { schema })
  }
  return cached
}

export { schema }
