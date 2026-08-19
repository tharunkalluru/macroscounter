import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb, schema } from './_db'

// A plain `ReturnType<typeof betterAuth>` loses the concrete option types
// betterAuth infers from a specific call (its own signature is generic), so
// the lazily-cached instance is typed off this wrapper's own inferred
// return type instead.
function buildAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: 'pg', schema: schema.authSchema }),
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.VITE_APP_URL,
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
  })
}

let cached: ReturnType<typeof buildAuth> | undefined

/**
 * Lazily-created Better Auth instance (Google-only social provider). Lazy
 * for the same reason `getDb()` is: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
 * `AUTH_SECRET` aren't set in dev/CI/test environments, and building this at
 * module-import time would break `tsc`/`vitest`/`vite build` for anyone
 * without them configured. Only constructed the first time a request
 * actually needs it.
 */
export function getAuth() {
  if (!cached) {
    cached = buildAuth()
  }
  return cached
}
