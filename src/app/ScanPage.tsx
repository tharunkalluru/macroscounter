import { BrowserMultiFormatReader } from '@zxing/browser'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { activeMealWindow } from '../domain/mealPrompt/activeMealWindow'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
const NO_DECODE_TIMEOUT_MS = 5000

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
      <Link
        to="/"
        className="mb-4 inline-flex min-h-touch items-center text-sm text-brand-700 dark:text-brand-400 underline"
      >
        ← Back
      </Link>
      <h1 className="mb-1 text-xl font-bold text-brand-700 dark:text-brand-400">
        Scan barcode · {MEAL_LABELS[meal]}
      </h1>

      <div className="relative mt-3 overflow-hidden rounded-xl bg-slate-900" data-testid="camera-preview">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
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
            <span aria-hidden="true">💡</span>
          </button>
        )}
      </div>

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
                className="min-h-touch w-full rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
              />
            </label>
            <button type="submit" className="rounded bg-brand-700 px-4 py-2 font-medium text-white">
              Look up
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
