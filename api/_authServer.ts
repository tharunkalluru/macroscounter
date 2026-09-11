import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { sendOTPEmail, sendResetPasswordEmail } from './_email.js'
import { getDb, schema } from './_db.js'

// A plain `ReturnType<typeof betterAuth>` loses the concrete option types
// betterAuth infers from a specific call (its own signature is generic), so
// the lazily-cached instance is typed off this wrapper's own inferred
// return type instead.
function buildAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: 'pg', schema: schema.authSchema }),
    secret: process.env.AUTH_SECRET,
    baseURL: process.env.VITE_APP_URL,
    // Reported live: adding the bitewise.food custom domain broke sign-in
    // and sign-up entirely on it (POST /api/auth/sign-in/email -> 403
    // "Invalid origin", confirmed directly against production) -- Better
    // Auth's CSRF/origin check trusts only baseURL's own origin unless told
    // otherwise, and VITE_APP_URL still pointed at the old domain. Explicitly
    // trusting every domain this app is actually served from means a stale
    // VITE_APP_URL (or a future domain change before it's updated) degrades
    // gracefully instead of taking down every account-based flow at once.
    // baseURL itself still needs to be the one currently-canonical URL --
    // it's what OAuth callback URIs and emailed reset links are built from,
    // and only one absolute URL can be correct there.
    trustedOrigins: ['https://bitewise.food', 'https://www.bitewise.food', 'https://*.vercel.app'],
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    emailAndPassword: {
      enabled: true,
      // Not gating sign-in on it — there's no email-sending flow for it
      // today beyond what's below, and the ask was password auth + reset +
      // OTP, not a verification-gated account system.
      requireEmailVerification: false,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => sendResetPasswordEmail(user.email, url),
    },
    plugins: [
      emailOTP({
        // Same account either way (email/password or Google) can also sign
        // in with a one-time code -- and a code alone can create a fresh
        // account too, matching how Google sign-in already auto-creates on
        // first use.
        sendVerificationOTP: async ({ email, otp, type }) => sendOTPEmail(email, otp, type),
        disableSignUp: false,
      }),
    ],
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
