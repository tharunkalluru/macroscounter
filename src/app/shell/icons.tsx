interface IconProps {
  active?: boolean
  className?: string
}

const STROKE = 1.8

export function TodayIcon({ active, className }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M6 10v8a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-8"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  )
}

export function HistoryIcon({ active, className }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="4"
        y="5.5"
        width="16"
        height="14.5"
        rx="2"
        stroke="currentColor"
        strokeWidth={STROKE}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
      <path d="M4 10h16" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </svg>
  )
}

export function ScanIcon({ className }: IconProps) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M18 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M6 20H4a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 12h16" stroke="currentColor" strokeWidth={STROKE + 0.4} strokeLinecap="round" />
    </svg>
  )
}

export function TrendsIcon({ active, className }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 18V9m5 9V5m5 13v-6m5 6V8"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.9}
      />
    </svg>
  )
}

export function SettingsIcon({ active, className }: IconProps) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="3.2"
        stroke="currentColor"
        strokeWidth={STROKE}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BarcodeIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 6v12M8 6v12M11 6v12M15 6v12M17 6v12M20 6v12"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5c.6 2.4-.4 3.9-1.8 5.4C8.6 9.5 7 11.3 7 14a5 5 0 0 0 10 0c0-1.6-.6-2.7-1.4-3.7.2 1.5-.3 2.5-1 3-.1-2-1-3-2-4.3-.7-.9-1-1.8-.6-3z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={0.15}
      />
    </svg>
  )
}

export function TargetIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="12" cy="12" r="4.8" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function FlashlightIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 3h8l-1.5 6H16a1 1 0 0 1 .8 1.6L10 21v-7H8.5a1 1 0 0 1-1-1.2L9 9H7.5L8 3Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth={STROKE} />
    </svg>
  )
}

export function InstallIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" strokeWidth={STROKE} />
      <path d="M12 8v6M9 11.5l3 3 3-3" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth={STROKE + 0.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={STROKE + 0.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
