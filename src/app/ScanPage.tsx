import { BrowserMultiFormatReader } from '@zxing/browser'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { ScannedProductRepo } from '../data/repos/ScannedProductRepo'
import { lookupProduct } from '../domain/barcode/lookupProduct'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

export default function ScanPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = (searchParams.get('meal') as Meal) || 'breakfast'

  const videoRef = useRef<HTMLVideoElement>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const [cameraStatus, setCameraStatus] = useState<'starting' | 'active' | 'unavailable'>('starting')
  const [lookingUp, setLookingUp] = useState(false)
  const handledRef = useRef(false)

  useEffect(() => {
    let stopped = false
    let stopFn: (() => void) | undefined

    async function handleDetected(barcode: string) {
      if (handledRef.current) return
      handledRef.current = true
      stopFn?.()
      await resolveBarcode(barcode)
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
          const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
            if (result) handleDetected(result.getText())
          })
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

  async function resolveBarcode(barcode: string) {
    setLookingUp(true)
    const result = await lookupProduct(barcode.trim(), {
      scannedProductRepo: new ScannedProductRepo(),
      fdcApiKey: import.meta.env.VITE_FDC_API_KEY || undefined,
    })
    if (result.product) {
      navigate(`/scan/product/${barcode.trim()}?meal=${meal}`)
    } else {
      navigate(`/scan/not-found/${barcode.trim()}?meal=${meal}`)
    }
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault()
    if (manualBarcode.trim()) resolveBarcode(manualBarcode.trim())
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back
      </Link>
      <h1 className="mb-1 text-xl font-bold text-brand-700">Scan barcode · {MEAL_LABELS[meal]}</h1>

      <div className="mt-3 overflow-hidden rounded-xl bg-slate-900" data-testid="camera-preview">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        {cameraStatus === 'unavailable' && (
          <p className="p-4 text-center text-sm text-slate-300">
            Camera unavailable — use manual entry below.
          </p>
        )}
      </div>

      {lookingUp && <p className="mt-3 text-sm text-slate-500">Looking up product…</p>}

      <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Barcode number</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter barcode number"
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
          />
        </label>
        <button type="submit" className="rounded bg-brand-600 px-4 py-2 font-medium text-white">
          Look up
        </button>
      </form>
    </div>
  )
}
