import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SetupResponseSchema } from '../domain/ai/setup'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import { DIET_STYLE_OPTIONS, PROTEIN_PRIORITY_OPTIONS, type DietStyle, type ProteinPriority } from '../domain/goals/onboardingOptions'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'
import { useSession } from '../lib/auth/authClient'
import { todayISO } from '../lib/date'
import { saveSetup } from '../lib/onboarding/saveSetup'
import FoodDiaryIllustration from './components/FoodDiaryIllustration'
import HeightInput, { type HeightUnit } from './components/HeightInput'
import WeightInput, { type WeightUnit } from './components/WeightInput'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { ArrowLeftIcon, SparkleIcon } from './shell/icons'

const GOALS: { value: Goal; title: string; detail: string }[] = [
  { value: 'cut', title: 'Lose weight', detail: 'A steady, manageable approach' },
  { value: 'maintain', title: 'Find my balance', detail: 'Understand food and maintain weight' },
  { value: 'gain', title: 'Build & gain', detail: 'Fuel training and gradual weight gain' },
]
const ACTIVITIES: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Mostly sitting · little exercise' },
  { value: 'light', label: 'Lightly active · exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderately active · exercise 3–5 days/week' },
  { value: 'active', label: 'Very active · exercise most days' },
  { value: 'very_active', label: 'Physical work & intense training' },
]
const BUTTON = 'pressable flex min-h-touch items-center justify-center rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:opacity-50'

export default function QuickOnboardingFlow({ onDetailed }: { onDetailed: () => void }) {
  const { data: session, isPending } = useSession()
  const userId = session?.user.id ?? null
  return <QuickSetupForm key={userId ?? 'guest'} userId={userId} sessionPending={isPending} onDetailed={onDetailed} />
}

function QuickSetupForm({ onDetailed, userId, sessionPending }: { onDetailed: () => void; userId: string | null; sessionPending: boolean }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState<Goal>('maintain')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary')
  const [dietStyle, setDietStyle] = useState<DietStyle>('balanced')
  const [proteinPriority, setProteinPriority] = useState<ProteinPriority>('moderate')
  const [rate, setRate] = useState('0.5')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveLock = useRef(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiApplied, setAiApplied] = useState(false)
  const [aiNotes, setAiNotes] = useState<string[]>([])
  const request = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (step > 0) heading.current?.focus() }, [step])

  const basicsValid = !!sex && Number.isInteger(Number(age)) && Number(age) >= 18 && Number(age) <= 100 && Number(heightCm) >= 100 && Number(heightCm) <= 250 && Number(weightKg) >= 30 && Number(weightKg) <= 300
  const preview = basicsValid ? computeGoalTargets({
    sex: sex as Sex, age: Number(age), heightCm: Number(heightCm), weightKg: Number(weightKg), activityLevel, goal,
    goalRateLbPerWeek: goal === 'maintain' ? undefined : Number(rate),
    fatGPerKg: DIET_STYLE_OPTIONS.find((option) => option.value === dietStyle)?.fatGPerKg,
    proteinGPerKg: PROTEIN_PRIORITY_OPTIONS.find((option) => option.value === proteinPriority)?.proteinGPerKg,
  }) : null

  async function fillWithAI() {
    if (request.current || !userId || !description.trim()) return
    const controller = new AbortController()
    request.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 100_000)
    setAiBusy(true); setAiError(null); setAiNotes([]); setAiApplied(false)
    try {
      const response = await fetch('/api/ai/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: description.trim() }), signal: controller.signal })
      if (!response.ok) {
        const failure = await response.json().catch(() => ({})) as { code?: string }
        throw new Error(response.status === 429 ? failure.code === 'daily_limit' ? 'AI is at its daily limit. You can still fill in every detail below.' : 'AI is busy right now. Try again shortly or continue manually.' : response.status === 401 ? 'Sign in again to use AI, or continue manually.' : 'AI could not fill your details. You can continue manually.')
      }
      const result = SetupResponseSchema.safeParse(await response.json())
      if (!result.success) throw new Error('That draft could not be read. Please fill in your details below.')
      if (controller.signal.aborted) return
      const draft = result.data.draft
      setAiNotes(result.data.notes)
      if (!Object.values(draft).some((value) => value !== null)) {
        setAiError('No setup details were found. Add your name, age, height or weight, or continue manually.')
        return
      }
      if (draft.name !== null) setName(draft.name)
      if (draft.age !== null) setAge(String(draft.age))
      if (draft.sex !== null) setSex(draft.sex)
      if (draft.heightCm !== null) { setHeightUnit('cm'); setHeightCm(String(draft.heightCm)) }
      if (draft.weightKg !== null) { setWeightUnit('kg'); setWeightKg(String(draft.weightKg)) }
      if (draft.activityLevel !== null) setActivityLevel(draft.activityLevel)
      if (draft.goal !== null) setGoal(draft.goal)
      if (draft.dietStyle !== null) setDietStyle(draft.dietStyle)
      setAiApplied(true)
    } catch (caught) {
      setAiError(controller.signal.aborted ? 'AI took too long. Continue manually or try again.' : caught instanceof Error ? caught.message : 'AI is unavailable. Continue manually.')
    } finally {
      window.clearTimeout(timeout); request.current = null; setAiBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (step === 0) {
      if (!name.trim()) { setError('Enter the name you would like us to use.'); return }
      setStep(1); return
    }
    if (!basicsValid || !preview) { setError('Check your details: age 18–100, height 100–250 cm, weight 30–300 kg, and a calculation sex.'); return }
    if (step === 1) { setStep(2); return }
    if (saveLock.current) return
    saveLock.current = true; setSaving(true)
    try {
      await saveSetup({ name: name.trim(), age: Number(age), sex: sex as Sex, heightCm: Number(heightCm), weightKg: Number(weightKg), heightUnit, weightUnit, activityLevel, goal, dietStyle, proteinPriority, calorieFloorChoice: 'standard', goalRateLbPerWeek: goal === 'maintain' ? undefined : Number(rate) }, {
        effectiveDate: todayISO(), kcal: preview.kcal, proteinG: preview.proteinG, carbsG: preview.carbsG, fatG: preview.fatG, fiberG: preview.fiberG, source: 'computed',
      })
      navigate('/', { replace: true, state: { justOnboarded: true } })
    } catch {
      setError('Your setup could not be saved. Your answers are still here. Please try again.')
      saveLock.current = false; setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-base px-5 py-6 dark:bg-surface-dark-base sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight text-brand-700 dark:text-brand-400"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900"><SparkleIcon /></span>Bitewise</div>
        <div className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <aside className="lg:sticky lg:top-12">
            <div className={step > 0 ? 'hidden lg:block' : ''}><p className="text-caption font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-400">A little awareness. Every day.</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Good food.<br />A plan that fits you.</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">Start with the essentials. Make sense of your meals, keep your favorites close, and find your own rhythm.</p>
            <FoodDiaryIllustration className="mt-6 hidden h-48 w-72 lg:block" /></div>
            <ol aria-label="Setup progress" className="mt-6 flex gap-4 text-caption lg:flex-col lg:gap-5">
              {['Your focus', 'The essentials', 'Your starting plan'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={`flex items-center gap-2 ${step === index ? 'font-semibold text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step === index ? 'bg-brand-100 dark:bg-brand-900' : 'bg-slate-100 dark:bg-slate-800'}`}>{index + 1}</span><span>{label}</span></li>)}
            </ol>
          </aside>
          <form onSubmit={handleSubmit} noValidate className="min-w-0 rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark sm:p-8">
            <div className="mb-5 flex items-center justify-between text-caption text-slate-500 dark:text-slate-400"><span>Step {step + 1} of 3</span>{step > 0 && <button disabled={saving} type="button" onClick={() => { setStep(step - 1); setError(null) }} className="pressable flex min-h-touch items-center gap-1" aria-label="Previous setup step"><ArrowLeftIcon />Back</button>}</div>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{['Make it yours.', 'Just the essentials.', 'Your starting point.'][step]}</h1>
            <p className="mb-6 mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{['What would you like food tracking to help with?', 'These details help estimate your daily targets. You can change them in Settings.', 'A flexible estimate, ready to adjust as you learn what works for you.'][step]}</p>
            {step === 0 && <div className="space-y-5">
              <div><label htmlFor="quick-name" className="mb-2 block text-sm font-medium">What should we call you?</label><input id="quick-name" autoComplete="given-name" maxLength={80} value={name} disabled={aiBusy} onChange={(event) => setName(event.target.value)} placeholder="Your name" className={`w-full ${TEXT_INPUT_CLASS}`} /></div>
              <fieldset><legend className="mb-2 text-sm font-medium">Your focus</legend><div className="space-y-2">{GOALS.map((option) => <label key={option.value} className={`flex min-h-touch cursor-pointer items-center gap-3 rounded-xl border p-3.5 ${goal === option.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 dark:border-slate-700'}`}><input type="radio" name="quick-goal" disabled={aiBusy} value={option.value} checked={goal === option.value} onChange={() => setGoal(option.value)} className="h-4 w-4 accent-brand-700" /><span><span className="block text-sm font-semibold">{option.title}</span><span className="text-caption text-slate-500 dark:text-slate-400">{option.detail}</span></span></label>)}</div></fieldset>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><button type="button" aria-expanded={aiOpen} aria-controls="setup-ai" onClick={() => setAiOpen(!aiOpen)} className="flex min-h-touch w-full items-center justify-between gap-2 text-left text-sm font-semibold"><span className="flex items-center gap-2"><SparkleIcon />Fill the details with AI</span><span aria-hidden="true">{aiOpen ? '−' : '+'}</span></button>
                {aiOpen && <div id="setup-ai" className="mt-2 space-y-3"><p className="text-caption leading-relaxed text-slate-500 dark:text-slate-400">Describe your basics in your own words. AI drafts the fields; you review everything before saving. Your description is sent to our AI provider when you choose Fill my details.</p><label htmlFor="setup-description" className="block text-sm font-medium">About you</label><textarea id="setup-description" maxLength={1500} rows={4} disabled={aiBusy} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="I'm Alex, 30, male, 175 cm and 75 kg. I walk daily and want to maintain my weight." className={`w-full resize-y ${TEXT_INPUT_CLASS}`} />{userId ? <button type="button" disabled={aiBusy || !description.trim()} onClick={fillWithAI} className={`${BUTTON} w-full`}>{aiBusy ? 'Preparing your draft…' : 'Fill my details'}</button> : <p className="text-caption text-slate-500 dark:text-slate-400">{sessionPending ? 'Checking AI access…' : <><Link className="font-semibold text-brand-700 underline dark:text-brand-400" to="/welcome">Sign in to use AI</Link>, or continue manually below.</>}</p>}{aiNotes.length > 0 && <div className="text-caption text-slate-500 dark:text-slate-400"><p className="font-medium">Draft notes</p>{aiNotes.map((note, index) => <p key={index} className="mt-1">{note}</p>)}</div>}{aiError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{aiError}</p>}</div>}
              </div>
              {aiApplied && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Your draft is filled in. Review your focus here and every detail on the next screen. Anything you did not share still needs your input.</p>}
            </div>}
            {step === 1 && <div className="space-y-5">
              {aiApplied && <p className="rounded-xl bg-brand-50 p-3 text-caption text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">AI-assisted draft. Check each value before continuing.</p>}
              <div className="grid grid-cols-2 gap-3"><div><label htmlFor="quick-age" className="mb-2 block text-sm font-medium">Age</label><input id="quick-age" type="number" min="18" max="100" inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Years" className={`w-full ${TEXT_INPUT_CLASS}`} /></div><div><label htmlFor="quick-sex" className="mb-2 block text-sm font-medium">Calculation sex</label><select id="quick-sex" value={sex} onChange={(event) => setSex(event.target.value as Sex)} className={`w-full ${TEXT_INPUT_CLASS}`}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option></select></div></div>
              <p className="text-caption text-slate-500 dark:text-slate-400">Sex is used only for the energy and fiber formulas. This setup is for adults.</p>
              <fieldset><legend className="mb-2 text-sm font-medium">Height</legend><HeightInput valueCm={heightCm} onChangeCm={setHeightCm} unit={heightUnit} onUnitChange={setHeightUnit} /></fieldset>
              <fieldset><legend className="mb-2 text-sm font-medium">Current weight</legend><WeightInput valueKg={weightKg} onChangeKg={setWeightKg} unit={weightUnit} onUnitChange={setWeightUnit} /></fieldset>
              <div><label htmlFor="quick-activity" className="mb-2 block text-sm font-medium">Typical activity</label><select id="quick-activity" value={activityLevel} onChange={(event) => setActivityLevel(event.target.value as ActivityLevel)} className={`w-full ${TEXT_INPUT_CLASS}`}>{ACTIVITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            </div>}
            {step === 2 && preview && <div className="space-y-5">
              <section className="rounded-2xl bg-brand-50 p-5 dark:bg-brand-900/30" aria-label="Your starting targets"><p className="text-sm text-brand-700 dark:text-brand-300">{name.trim()}'s daily starting target</p><p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight" data-testid="quick-setup-kcal">{preview.kcal.toLocaleString()} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">kcal</span></p><div className="mt-5 grid grid-cols-3 gap-2 text-sm">{[['Protein', preview.proteinG], ['Carbs', preview.carbsG], ['Fat', preview.fatG]].map(([label, value]) => <div key={label}><p className="text-caption text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 font-semibold tabular-nums">{value} g</p></div>)}</div></section>
              {preview.adjustments && <p role="status" className="rounded-xl border border-brand-200 p-3 text-caption leading-relaxed text-brand-700 dark:border-brand-800 dark:text-brand-300">{preview.adjustments.caloriesRaisedFrom !== undefined && `Energy was raised from ${preview.adjustments.caloriesRaisedFrom} kcal so your protein and baseline fat allocation fit. Your preferred pace may change. `}{preview.adjustments.fatReducedFrom !== undefined && `Fat was adjusted from ${preview.adjustments.fatReducedFrom} g to fit the displayed calorie target. `}The grams above are your actual starting targets.</p>}
              <div><label htmlFor="quick-diet" className="mb-2 block text-sm font-medium">Macro balance</label><select id="quick-diet" disabled={saving} value={dietStyle} onChange={(event) => setDietStyle(event.target.value as DietStyle)} className={`w-full ${TEXT_INPUT_CLASS}`}><option value="balanced">Balanced</option><option value="low_fat">Baseline fat allocation</option><option value="low_carb">Higher fat, fewer carbs</option><option value="keto">Highest fat allocation</option></select><p className="mt-2 text-caption text-slate-500 dark:text-slate-400">Compare the actual grams above. These choices do not guarantee a ketogenic diet.</p></div>
              <div><label htmlFor="quick-protein" className="mb-2 block text-sm font-medium">Protein priority</label><select id="quick-protein" disabled={saving} value={proteinPriority} onChange={(event) => setProteinPriority(event.target.value as ProteinPriority)} className={`w-full ${TEXT_INPUT_CLASS}`}><option value="low">Baseline · 1.6 g/kg</option><option value="moderate">Standard · 1.8 g/kg</option><option value="high">Higher · 2.0 g/kg</option><option value="extra_high">Highest · 2.2 g/kg</option></select></div>
              {goal !== 'maintain' && <div><label htmlFor="quick-rate" className="mb-2 block text-sm font-medium">Preferred pace</label><select id="quick-rate" disabled={saving} value={rate} onChange={(event) => setRate(event.target.value)} className={`w-full ${TEXT_INPUT_CLASS}`}><option value="0.5">Gradual · about 0.2 kg / 0.5 lb per week</option><option value="1">Steady · about 0.45 kg / 1 lb per week</option></select><p className="mt-2 text-caption text-slate-500 dark:text-slate-400">A preference, not a predicted result. The standard calorie floor still applies.</p></div>}
              <p className="text-caption leading-relaxed text-slate-500 dark:text-slate-400">Calculated from the details you reviewed, using the existing energy formula. Your logged meals and weekly check-ins help you revisit the plan. You can edit targets in Settings.</p>
            </div>}
            {error && <p role="alert" className="mt-5 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={saving || aiBusy} className={`${BUTTON} mt-6 w-full`} data-testid="quick-setup-continue">{saving ? 'Saving your plan…' : step === 2 ? 'Start my food diary' : step === 1 ? 'Review my plan' : 'Continue'}</button>
            {step === 0 && <button type="button" data-testid="onboarding-detailed" onClick={onDetailed} disabled={aiBusy} className="mt-2 min-h-touch w-full text-caption font-medium text-slate-500 dark:text-slate-400">Prefer more detail? Use guided setup</button>}
          </form>
        </div>
      </div>
    </main>
  )
}
