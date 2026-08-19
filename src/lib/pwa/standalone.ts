/** True once the app is already running as an installed/standalone PWA — install prompts should never show. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return displayModeStandalone || iosStandalone
}

/** iOS has no `beforeinstallprompt` event — Safari needs the manual Share -> Add to Home Screen instructions instead. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
