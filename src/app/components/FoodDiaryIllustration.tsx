interface Props {
  className?: string
}

/** Original, decorative line artwork for an empty diary. */
export default function FoodDiaryIllustration({ className = 'h-28 w-44' }: Props) {
  return (
    <svg className={className} viewBox="0 0 192 128" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="97" cy="106" rx="58" ry="8" className="fill-slate-100 dark:fill-slate-800" />
      <circle cx="97" cy="61" r="47" className="fill-brand-50 dark:fill-brand-900/30" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <g className="text-slate-400 dark:text-slate-500">
          <path d="M36 51v53m-6-57v12a6 6 0 0 0 12 0V47m-6 0v13" />
          <path d="M158 65v39" />
          <ellipse cx="158" cy="54" rx="7" ry="12" />
        </g>
        <g className="text-brand-500 dark:text-brand-400">
          <path d="M88 61c-14-2-20-11-19-21 13 0 22 7 23 20" className="fill-brand-100 dark:fill-brand-900" />
          <path d="M97 62c-1-18 8-28 24-30 2 16-7 29-24 30Z" className="fill-brand-100 dark:fill-brand-900" />
          <path d="m97 64 15-21m-21 20-14-14" />
          <path d="M57 68h80c-2 21-16 35-40 35S59 89 57 68Z" className="fill-white dark:fill-surface-dark-card" />
          <path d="M58 76h78M84 107h26" />
          <path d="M67 82c3 7 7 11 14 14" opacity="0.5" />
        </g>
      </g>
    </svg>
  )
}
