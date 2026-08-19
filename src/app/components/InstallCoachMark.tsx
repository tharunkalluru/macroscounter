import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from '../../lib/pwa/standalone'

const DISMISS_KEY = 'macrodesi:installCoachMarkDismissed'

function isDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === '1'
}

function dismiss(): void {
  localStorage.setItem(DISMISS_KEY, '1')
}

/**
 * First-visit "Install MacroDesi" banner — Android/Chrome gets the native
 * `beforeinstallprompt` dialog behind a custom trigger button; iOS Safari
 * has no such event, so it gets illustrated Share -> Add to Home Screen
 * instructions instead. Never shows once the app is already installed
 * (standalone mode), and dismissing it persists so it doesn't reappear.
 */
export default function InstallCoachMark() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [dismissed, setDismissed] = useState(isDismissed)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    function handleBeforeInstallPrompt(e: BeforeInstallPromptEvent) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if (isIOS()) setShowIOSInstructions(true)

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  function handleDismiss() {
    dismiss()
    setDismissed(true)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    setDeferredPrompt(null)
    dismiss()
    setDismissed(true)
  }

  if (dismissed || isStandalone()) return null
  if (!deferredPrompt && !showIOSInstructions) return null

  return (
    <div
      className="flex items-start gap-3 border-b border-brand-100 bg-brand-50 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-700 dark:bg-slate-800"
      data-testid="install-coach-mark"
    >
      <span className="text-2xl" aria-hidden="true">
        📲
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Install MacroDesi</p>
        {deferredPrompt ? (
          <p className="text-caption text-slate-600 dark:text-slate-300">
            Add it to your home screen for a faster, full-screen experience.
          </p>
        ) : (
          <p className="text-caption text-slate-600 dark:text-slate-300">
            Tap <span aria-hidden="true">􀈂</span> Share, then "Add to Home Screen".
          </p>
        )}
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            data-testid="install-coach-mark-install"
            className="mt-2 min-h-touch rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white"
          >
            Install
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        data-testid="install-coach-mark-dismiss"
        className="flex min-h-touch min-w-touch shrink-0 items-center justify-center text-slate-500 dark:text-slate-400"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
