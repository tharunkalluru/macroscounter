import { Resend } from 'resend'

let cached: Resend | undefined

/**
 * Lazily-created Resend client, same pattern as `getAuth()`/`getDb()` — the
 * env var isn't set in dev/CI/test, and constructing this at module-import
 * time would break `tsc`/`vitest`/`vite build` for anyone without it
 * configured.
 */
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!cached) cached = new Resend(apiKey)
  return cached
}

// resend.dev's shared testing address works with zero setup (no domain
// verification), so password reset and sign-in codes work the moment
// RESEND_API_KEY is set. Swap in a verified sending domain via
// RESEND_FROM_EMAIL once one exists (see SETUP.md).
const FROM = process.env.RESEND_FROM_EMAIL || 'Bitewise <onboarding@resend.dev>'

function wrapper(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18123d">
    <p style="font-size:20px;font-weight:700;color:#352684;margin:0 0 20px">Bitewise</p>
    ${bodyHtml}
    <p style="font-size:12px;color:#636779;margin-top:32px">If you didn't request this, you can safely ignore this email.</p>
  </div>`
}

/**
 * Wired into `emailAndPassword.sendResetPassword` (api/_authServer.ts). Never
 * throws — a delivery failure is logged, not surfaced to the caller, since
 * the reset-request endpoint always returns a generic success regardless of
 * whether the email exists or sending worked, by design (not revealing
 * account existence via response differences).
 */
export async function sendResetPasswordEmail(to: string, url: string): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.error('sendResetPasswordEmail: RESEND_API_KEY not configured, email not sent')
    return
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Reset your Bitewise password',
    html: wrapper(`
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Tap the button below to choose a new password. This link expires in 1 hour.</p>
      <a href="${url}" style="display:inline-block;background:#352684;color:#fff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:14px">Reset password</a>
      <p style="font-size:13px;color:#636779;margin-top:20px;word-break:break-all">Or paste this link into your browser: ${url}</p>
    `),
  })
  if (error) console.error('sendResetPasswordEmail failed', { name: error.name })
}

const OTP_SUBJECTS: Record<string, string> = {
  'sign-in': 'Your Bitewise sign-in code',
  'forget-password': 'Your Bitewise password reset code',
  'email-verification': 'Verify your Bitewise email',
  'change-email': 'Confirm your new Bitewise email',
}

/** Wired into the `emailOTP` plugin's `sendVerificationOTP` (api/_authServer.ts). Same never-throws contract as sendResetPasswordEmail above. */
export async function sendOTPEmail(to: string, otp: string, type: string): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.error('sendOTPEmail: RESEND_API_KEY not configured, email not sent')
    return
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: OTP_SUBJECTS[type] ?? 'Your Bitewise verification code',
    html: wrapper(`
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px">Enter this code to continue. It expires in 5 minutes.</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#352684;margin:0 0 20px">${otp}</p>
    `),
  })
  if (error) console.error('sendOTPEmail failed', { name: error.name })
}
