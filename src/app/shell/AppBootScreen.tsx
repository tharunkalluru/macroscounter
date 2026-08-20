/** Full-screen boot state shown once, before the food DB finishes seeding. Mirrors the app icon's ring mark so the first paint feels like MacroDesi instead of a generic loading page. */
export default function AppBootScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface dark:bg-surface-dark"
      role="status"
      aria-label="Loading MacroDesi"
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        className="motion-safe:animate-spin"
        style={{ animationDuration: '1.1s' }}
        aria-hidden="true"
      >
        <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4" className="text-brand-100 dark:text-slate-800" />
        <path
          d="M28 6a22 22 0 0 1 22 22"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="text-brand-600 dark:text-brand-400"
        />
      </svg>
      <p className="text-title text-brand-700 dark:text-brand-400">MacroDesi</p>
    </div>
  )
}
