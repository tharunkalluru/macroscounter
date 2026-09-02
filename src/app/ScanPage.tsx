import { BrowserMultiFormatReader } from '@zxing/browser'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { activeMealWindow } from '../domain/mealPrompt/activeMealWindow'
import PageHeader from './components/PageHeader'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { FlashlightIcon } from './shell/icons'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
const NO_DECODE_TIMEOUT_MS = 5000

/**
 * Label (nutrition-panel OCR) and Photo (AI food-photo recognition) need a
 * vision-capable LLM API and new cost/rate-limit design — deliberately
 * deferred (see the Phase R.2 redesign plan's "explicitly deferred" list),
 * not silently dropped. Shown as disabled placeholders so the entry points
 * exist in the IA already.
 */
const SCAN_MODES = [
  { key: 'barcode', label: 'Barcode', available: true },
  { key: 'label', label: 'Label', available: false },
  { key: 'photo', label: 'Photo', available: false },
] as const

export default function ScanPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = (searchParams.get('meal') as Meal | null) || activeMealWindow(new Date()) || 'breakfast'

  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'unavailable'>(
    'starting'
  )
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const handledRef = useRef(false)

  useEffect(() => {
    let stopped = false
    let stopFn: (() => void) | undefined

    function handleDetected(barcode: string) {
      if (handledRef.current) return
      handledRef.current = true
      stopFn?.()
      // Navigate immediately — the product card owns its own lookup and
      // shows a skeleton while it's in flight, so the sheet slides up
      // perceptibly instantly instead of waiting on the network here.
      navigate(`/scan/product/${barcode.trim()}?meal=${meal}`)
    }

    async function start() {
      if (!videoRef.current) return
      try {
        if (typeof window !== 'undefined' && window.BarcodeDetector) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          })
          if (stopped) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraStatus('active')

          const track = stream.getVideoTracks()[0]
          trackRef.current = track ?? null
          const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
          setTorchSupported(!!capabilities?.torch)

          const detector = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
          const interval = setInterval(() => {
            if (!videoRef.current || handledRef.current) return
            detector
              .detect(videoRef.current)
              .then((codes) => {
                if (codes[0]) handleDetected(codes[0].rawValue)
              })
              .catch(() => {
                /* ignore per-frame detection errors */
              })
          }, 400)
          stopFn = () => {
            clearInterval(interval)
            stream.getTracks().forEach((t) => t.stop())
          }
        } else {
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromVideoDevice(
            undefined,
            videoRef.current,
            (result) => {
              if (result) handleDetected(result.getText())
            }
          )
          setCameraStatus('active')
          stopFn = () => controls.stop()
        }
      } catch {
        if (!stopped) setCameraStatus('unavailable')
      }
    }

    start()
    return () => {
      stopped = true
      stopFn?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Failure UX: no camera at all -> show manual entry right away. A camera
  // that's active but hasn't found anything after 5s -> surface it too.
  useEffect(() => {
    if (cameraStatus === 'unavailable') {
      setShowManualEntry(true)
      return
    }
    if (cameraStatus === 'active') {
      const timer = setTimeout(() => setShowManualEntry(true), NO_DECODE_TIMEOUT_MS)
      return () => clearTimeout(timer)
    }
  }, [cameraStatus])

  async function handleToggleTorch() {
    const track = trackRef.current
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      /* torch toggle failed (device doesn't actually support it despite capabilities) — no-op */
    }
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault()
    if (manualBarcode.trim()) navigate(`/scan/product/${manualBarcode.trim()}?meal=${meal}`)
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title={`Scan · ${MEAL_LABELS[meal]}`} backTo="/" />

      <div className="mt-1 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Scan mode">
        {SCAN_MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            role="tab"
            aria-selected={mode.key === 'barcode'}
            disabled={!mode.available}
            data-testid={`scan-mode-${mode.key}`}
            className={`flex min-h-touch flex-1 items-center justify-center gap-1 rounded-md text-sm font-medium ${
              mode.key === 'barcode'
                ? 'bg-white text-brand-700 shadow-sm dark:bg-surface-dark-card dark:text-brand-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {mode.label}
            {!mode.available && <span className="text-caption">Soon</span>}
          </button>
        ))}
      </div>

      <div className="relative mt-3 overflow-hidden rounded-xl bg-slate-900" data-testid="camera-preview">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        {cameraStatus === 'active' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="h-2/3 w-4/5 rounded-2xl border-2 border-white/60" />
          </div>
        )}
        {cameraStatus === 'unavailable' && (
          <p className="p-4 text-center text-sm text-slate-300">
            Camera unavailable — use manual entry below.
          </p>
        )}
        {cameraStatus === 'active' && torchSupported && (
          <button
            type="button"
            onClick={handleToggleTorch}
            aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
            aria-pressed={torchOn}
            data-testid="torch-toggle"
            className={`absolute bottom-2 right-2 flex min-h-touch min-w-touch items-center justify-center rounded-full ${torchOn ? 'bg-amber-400 text-slate-900' : 'bg-slate-800/80 text-white'}`}
          >
            <FlashlightIcon />
          </button>
        )}
      </div>
      {cameraStatus === 'active' && (
        <p className="mt-2 text-center text-caption uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Works offline · cached products scan instantly
        </p>
      )}

      {showManualEntry && (
        <div className="mt-4" data-testid="manual-entry-fallback">
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            Having trouble? Type the barcode.
          </p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Barcode number</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter barcode number"
                className={TEXT_INPUT_CLASS}
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="min-h-touch rounded-card bg-brand-700 px-4 font-medium text-white transition-transform active:scale-[0.98]"
            >
              Look up
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
