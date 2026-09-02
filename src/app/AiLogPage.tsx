import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import PageHeader from './components/PageHeader'
import { CameraIcon, SparkleIcon } from './shell/icons'

type Mode = 'snap' | 'describe'
const MAX_CHARS = 500

/**
 * AI logging entry point (frames 22/23) — per the scope decision, this is a
 * real, reachable screen wired to a clearly-labeled placeholder rather than
 * a live vision/LLM call, so it costs nothing to ship while the feature
 * itself waits on that infra decision.
 */
export default function AiLogPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const meal = (searchParams.get('meal') as Meal) ?? 'breakfast'
  const [mode, setMode] = useState<Mode>('describe')
  const [description, setDescription] = useState('')

  function handleAnalyse() {
    navigate(`/log/ai/result?meal=${meal}&description=${encodeURIComponent(description)}`)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <PageHeader title="Describe or snap" backTo="/" />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="AI logging mode">
        {(['snap', 'describe'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            data-testid={`ai-mode-${m}`}
            className={`min-h-touch flex-1 rounded-md text-sm font-medium capitalize transition-transform active:scale-[0.97] ${
              mode === m
                ? 'bg-white text-brand-700 shadow-sm dark:bg-surface-dark-card dark:text-brand-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'snap' ? (
        <div className="grid grid-cols-3 gap-2" data-testid="ai-photo-grid">
          <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500">
            <CameraIcon />
            <span className="text-caption">Add photo</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_CHARS))}
            placeholder="e.g. a bowl of chicken curry with two rotis and some cucumber raita"
            rows={5}
            data-testid="ai-description-input"
            className="min-h-touch w-full rounded-card border border-slate-300 p-3 text-sm dark:border-slate-600 dark:bg-surface-dark-card dark:text-slate-100"
          />
          <span className="self-end text-caption text-slate-400 dark:text-slate-500">
            {description.length}/{MAX_CHARS}
          </span>
        </div>
      )}

      <div className="mt-4 flex gap-3 rounded-card border border-slate-200 p-3.5 dark:border-slate-700">
        <SparkleIcon className="mt-0.5 flex-none text-brand-600 dark:text-brand-400" />
        <p className="text-caption leading-relaxed text-slate-500 dark:text-slate-400">
          We turn your words into database items — never invented numbers, and you can always edit before
          logging. <strong className="font-medium text-slate-600 dark:text-slate-300">AI logging is still in preview</strong> — the
          result below is a fixed example, not a real analysis of what you typed, until this ships for real.
        </p>
      </div>

      <button
        type="button"
        onClick={handleAnalyse}
        disabled={mode === 'describe' && description.trim().length === 0}
        data-testid="ai-analyse-button"
        className="mt-auto min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        Analyse this meal
      </button>
    </div>
  )
}
