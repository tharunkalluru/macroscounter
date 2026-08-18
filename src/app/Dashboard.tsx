import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import type { Profile, Targets } from '../data/models'

type LoadState = 'loading' | 'ready' | 'no-profile'

export default function Dashboard() {
  const [state, setState] = useState<LoadState>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [targets, setTargets] = useState<Targets | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const profileRepo = new ProfileRepo()
      const targetRepo = new TargetRepo()
      const p = await profileRepo.get()
      if (cancelled) return
      if (!p) {
        setState('no-profile')
        return
      }
      const t = await targetRepo.getLatest()
      if (cancelled) return
      setProfile(p)
      setTargets(t ?? null)
      setState('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  if (state === 'no-profile') {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-2xl font-bold text-brand-700">MacroDesi</h1>
      <p className="mt-1 text-sm text-slate-500">Hi {profile?.name}, here's today's targets.</p>

      <div className="mt-6 rounded-xl bg-white p-6 shadow" data-testid="targets-card">
        <p className="text-sm text-slate-500">Daily calorie target</p>
        <p className="text-4xl font-bold text-slate-900" data-testid="kcal-target">
          {targets?.kcal} kcal
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500">Protein</p>
            <p data-testid="protein-target" className="font-semibold">
              {targets?.proteinG} g
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Carbs</p>
            <p data-testid="carbs-target" className="font-semibold">
              {targets?.carbsG} g
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Fat</p>
            <p data-testid="fat-target" className="font-semibold">
              {targets?.fatG} g
            </p>
          </div>
        </div>
      </div>

      <Link to="/settings" className="mt-6 inline-block text-sm text-brand-600 underline">
        Edit profile
      </Link>
    </div>
  )
}
