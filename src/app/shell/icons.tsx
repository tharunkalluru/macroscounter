import type { ReactNode } from 'react'

interface IconProps {
  active?: boolean
  className?: string
}

/** Shared geometry keeps controls consistent and available without an icon-font request. */
function Icon({
  children,
  size,
  className,
}: {
  children: ReactNode
  size: number
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function TodayIcon({ active, className }: IconProps) {
  return (
    <Icon size={22} className={className}>
      {active ? (
        <path
          fill="currentColor"
          stroke="none"
          fillRule="evenodd"
          d="M10.69 2.91a2 2 0 0 1 2.62 0l7.5 6.53a.9.9 0 0 1-.59 1.58H20v8.23A2.75 2.75 0 0 1 17.25 22H6.75A2.75 2.75 0 0 1 4 19.25v-8.23h-.22a.9.9 0 0 1-.59-1.58l7.5-6.53ZM10 21h4v-6a2 2 0 0 0-4 0v6Z"
          clipRule="evenodd"
        />
      ) : (
        <>
          <path d="m3 10 9-7.5 9 7.5M5 8.5v10.75A1.75 1.75 0 0 0 6.75 21H10v-6a2 2 0 0 1 4 0v6h3.25A1.75 1.75 0 0 0 19 19.25V8.5" />
        </>
      )}
    </Icon>
  )
}

export function LogIcon({ active, className }: IconProps) {
  return (
    <Icon size={22} className={className}>
      {active ? (
        <path
          fill="currentColor"
          stroke="none"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6 2.5A2.5 2.5 0 0 0 3.5 5v14A2.5 2.5 0 0 0 6 21.5h12a2.5 2.5 0 0 0 2.5-2.5V5A2.5 2.5 0 0 0 18 2.5H6ZM7 6.625a.875.875 0 1 0 0 1.75h1a.875.875 0 1 0 0-1.75H7Zm4 0a.875.875 0 1 0 0 1.75h6a.875.875 0 1 0 0-1.75h-6ZM7 11.125a.875.875 0 1 0 0 1.75h1a.875.875 0 1 0 0-1.75H7Zm4 0a.875.875 0 1 0 0 1.75h6a.875.875 0 1 0 0-1.75h-6ZM7 15.625a.875.875 0 1 0 0 1.75h1a.875.875 0 1 0 0-1.75H7Zm4 0a.875.875 0 1 0 0 1.75h4a.875.875 0 1 0 0-1.75h-4Z"
        />
      ) : (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M7 7.5h1m3 0h6M7 12h1m3 0h6M7 16.5h1m3 0h4" />
        </>
      )}
    </Icon>
  )
}

export function PlusIcon({ className }: IconProps) {
  return <Icon size={22} className={className}><path d="M12 5v14M5 12h14" /></Icon>
}

export function TrendsIcon({ active, className }: IconProps) {
  return (
    <Icon size={22} className={className}>
      {active && <path d="M4 14.5 9 9l4 4 7-8v15H4Z" fill="currentColor" fillOpacity={0.2} stroke="none" />}
      <path d="M4 4v16h16M4 14.5 9 9l4 4 7-8" />
      {active && <circle cx="20" cy="5" r="1.5" fill="currentColor" stroke="none" />}
    </Icon>
  )
}

export function CoachIcon({ active, className }: IconProps) {
  return (
    <Icon size={22} className={className}>
      <path d="m12 2.8 2.7 6.5 6.5 2.7-6.5 2.7-2.7 6.5-2.7-6.5-6.5-2.7 6.5-2.7Z" fill={active ? 'currentColor' : 'none'} />
    </Icon>
  )
}

export function BarcodeIcon({ className }: IconProps) {
  return (
    <Icon size={20} className={className}>
      <path d="M5 3H3v4m16-4h2v4M3 17v4h2m14 0h2v-4M7 7v10m3-10v10m4-10v10m3-10v10" />
    </Icon>
  )
}

export function FlameIcon({ className }: IconProps) {
  return (
    <Icon size={14} className={className}>
      <path d="M13 2c1 5-3.5 6-3.5 9.5-1.2-.8-1.7-2-1.5-3.5C5.6 10.4 4 12.6 4 15a8 8 0 0 0 16 0c0-5.1-3.6-10-7-13Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function TargetIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function FlashlightIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <path d="M6 3h12v5l-3 4v8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-8L6 8V3Zm0 5h12m-6 6v2" />
    </Icon>
  )
}

export function CameraIcon({ className }: IconProps) {
  return (
    <Icon size={20} className={className}>
      <path d="m8.5 5 1-2h5l1 2H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.5Z" />
      <circle cx="12" cy="13" r="4" />
    </Icon>
  )
}

export function InstallIcon({ className }: IconProps) {
  return (
    <Icon size={20} className={className}>
      <path d="M12 3v12m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </Icon>
  )
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <path d="m12 2.8 2.7 6.5 6.5 2.7-6.5 2.7-2.7 6.5-2.7-6.5-6.5-2.7 6.5-2.7Z" />
    </Icon>
  )
}

export function HeartIcon({ active, className }: IconProps) {
  return (
    <Icon size={20} className={className}>
      <path d="M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z" fill={active ? 'currentColor' : 'none'} />
    </Icon>
  )
}

/** Date-stepper chevrons, distinct from page back-navigation. */
export function ChevronLeftIcon({ className }: IconProps) {
  return <Icon size={20} className={className}><path d="m14.5 5-7 7 7 7" /></Icon>
}

export function ChevronRightIcon({ className }: IconProps) {
  return <Icon size={20} className={className}><path d="m9.5 5 7 7-7 7" /></Icon>
}

export function ArrowLeftIcon({ className }: IconProps) {
  return <Icon size={20} className={className}><path d="m10 5-7 7 7 7M3 12h18" /></Icon>
}

export function ForkKnifeIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M19 3c-3 2-4 5.5-4 10h4m0-10v18" />
    </Icon>
  )
}

export function PaletteIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.8 1.8 0 0 1 1.3-3.1H18a3 3 0 0 0 3-3A8.5 8.5 0 0 0 12 3Z" />
      <circle cx="7" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M10 10v7m4-7v7" />
    </Icon>
  )
}

export function MicIcon({ active, className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill={active ? 'currentColor' : 'none'} />
      <path d="M5 10.5V12a7 7 0 0 0 14 0v-1.5M12 19v3m-3 0h6" />
    </Icon>
  )
}

export function DragHandleIcon({ className }: IconProps) {
  return (
    <Icon size={18} className={className}>
      {[6, 12, 18].map((y) => (
        <g key={y} fill="currentColor" stroke="none">
          <circle cx="9" cy={y} r="1.5" />
          <circle cx="15" cy={y} r="1.5" />
        </g>
      ))}
    </Icon>
  )
}
