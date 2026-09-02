const DEFAULT_LOG_VIEW_KEY = 'macrodesi:defaultLogView'

export type DefaultLogView = 'meals' | 'timeline'

/**
 * Which of Log's two per-day views opens by default (Settings > Food log,
 * frame 35) — local-only, same storage pattern as the theme preference.
 * Defaults to 'meals', matching today's hardcoded behavior for anyone who's
 * never touched it.
 */
export function getDefaultLogView(): DefaultLogView {
  return localStorage.getItem(DEFAULT_LOG_VIEW_KEY) === 'timeline' ? 'timeline' : 'meals'
}

export function setDefaultLogView(view: DefaultLogView): void {
  localStorage.setItem(DEFAULT_LOG_VIEW_KEY, view)
}
