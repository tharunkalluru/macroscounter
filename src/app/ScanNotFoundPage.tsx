import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ScannedProductRepo } from '../data/repos/ScannedProductRepo'
import { getLabelReader } from '../domain/barcode/labelReader'
import { diaryDate, todayISO } from '../lib/date'
import PageHeader from './components/PageHeader'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { CameraIcon } from './shell/icons'

export default function ScanNotFoundPage() {
  const { barcode } = useParams<{ barcode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const entryDate = diaryDate(searchParams.get('date'))
  const meal = searchParams.get('meal') || 'breakfast'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [servingSize, setServingSize] = useState('')
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [readingLabel, setReadingLabel] = useState(false)

  async function handlePhotoSelected(file: File) {
    setReadingLabel(true)
    setError(null)
    try {
      const label = await getLabelReader().readLabel(file)
      if (label) {
        if (label.name) setName(label.name)
        if (label.per100g?.kcal !== undefined) setKcal(String(label.per100g.kcal))
        if (label.per100g?.p !== undefined) setP(String(label.per100g.p))
        if (label.per100g?.c !== undefined) setC(String(label.per100g.c))
        if (label.per100g?.f !== undefined) setF(String(label.per100g.f))
      } else setError('Label reading is not available. Please enter the label values below.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The label could not be read. Please enter it manually.')
    } finally {
      setReadingLabel(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (savingRef.current) return
    setError(null)
    if (!barcode) return

    const kcalNum = Number(kcal)
    const pNum = Number(p)
    const cNum = Number(c)
    const fNum = Number(f)
    const servingSizeNum = servingSize ? Number(servingSize) : undefined

    if (!name.trim()) return setError('Please enter a product name.')
    if (!Number.isFinite(kcalNum) || kcalNum < 0) return setError('Calories must be 0 or more.')

    if (!kcal.trim()) return setError('Please enter calories per 100 g.')
    if ([pNum, cNum, fNum].some((value) => !Number.isFinite(value) || value < 0)) return setError('Nutrients must be 0 or more.')
    if (servingSizeNum !== undefined && (!Number.isFinite(servingSizeNum) || servingSizeNum <= 0)) return setError('Serving size must be greater than 0.')
    savingRef.current = true
    setSaving(true)
    try {
    await new ScannedProductRepo().put({
      barcode,
      name: name.trim(),
      brand: brand.trim() || undefined,
      per100g: { kcal: kcalNum, p: pNum, c: cNum, f: fNum },
      servingSize: servingSizeNum,
      source: 'manual',
      firstScanned: todayISO(),
    })

    navigate(`/scan/product/${barcode}?meal=${meal}&date=${entryDate}`)
    } catch {
      setError('The product could not be saved. Please try again.')
    } finally { savingRef.current = false; setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Product not found" backTo={`/scan?meal=${meal}&date=${entryDate}`} backLabel="Back to scan" />
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Barcode <span className="font-mono">{barcode}</span> isn't in our database yet. Add it once
        and it'll be remembered for next time.
      </p>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={readingLabel || import.meta.env.VITE_LABEL_READER_ENABLED !== 'true'}
        className="flex min-h-touch w-full items-center justify-center gap-2 rounded-card border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 transition-transform active:scale-[0.98] dark:border-slate-600 dark:text-slate-300"
      >
        <CameraIcon />
        {readingLabel ? 'Reading label…' : import.meta.env.VITE_LABEL_READER_ENABLED === 'true' ? 'Photo of nutrition label' : 'Enter the nutrition label below'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handlePhotoSelected(file)
        }}
      />

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Product name</span>
          <input
            className={TEXT_INPUT_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Brand (optional)</span>
          <input
            className={TEXT_INPUT_CLASS}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </label>

        <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
          Per 100 g
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Calories</span>
            <input
              type="number"
              min="0"
              step="any"
              className={TEXT_INPUT_CLASS}
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Serving size (g)</span>
            <input
              type="number"
              min="0"
              step="any"
              className={TEXT_INPUT_CLASS}
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Protein (g)</span>
            <input
              type="number"
              min="0"
              step="any"
              className={TEXT_INPUT_CLASS}
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Carbs (g)</span>
            <input
              type="number"
              min="0"
              step="any"
              className={TEXT_INPUT_CLASS}
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Fat (g)</span>
            <input
              type="number"
              min="0"
              step="any"
              className={TEXT_INPUT_CLASS}
              value={f}
              onChange={(e) => setF(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </form>
    </div>
  )
}
