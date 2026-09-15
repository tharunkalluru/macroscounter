import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import CaloriesRing from './components/CaloriesRing'
import MacroBar from './components/MacroBar'
import {
  BarcodeIcon,
  CoachIcon,
  FlameIcon,
  ForkKnifeIcon,
  HeartIcon,
  InstallIcon,
  MicIcon,
  SparkleIcon,
  TargetIcon,
  TrendsIcon,
} from './shell/icons'

interface Feature {
  Icon: ComponentType<{ className?: string }>
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    Icon: SparkleIcon,
    title: 'AI-powered logging',
    body: 'Type what you ate, snap a photo of your plate, or just say it out loud - Claude estimates calories and macros for you.',
  },
  {
    Icon: BarcodeIcon,
    title: 'Barcode scanning',
    body: 'Scan any packaged product for instant, accurate nutrition data, pulled from Open Food Facts and USDA.',
  },
  {
    Icon: TargetIcon,
    title: 'Targets that adapt',
    body: "Calorie, protein, carb, fat, and fiber targets computed from your own profile and goal - not a generic formula.",
  },
  {
    Icon: CoachIcon,
    title: 'An AI coach that knows your data',
    body: 'Ask questions and get answers grounded in your own logged history, weight trend, and program - not generic advice.',
  },
  {
    Icon: TrendsIcon,
    title: 'Trends that explain themselves',
    body: 'Weight trend, expenditure estimate, logging streaks, and a weekly report that tells you what actually changed.',
  },
  {
    Icon: ForkKnifeIcon,
    title: 'Recipes, templates, and usuals',
    body: 'Build a recipe from ingredients once, save meal templates, and one-tap re-log the combos you eat all the time.',
  },
  {
    Icon: HeartIcon,
    title: 'Sync across every device',
    body: 'Sign in with Google, email and password, or a one-time email code - your diary follows you, and still works fully offline.',
  },
  {
    Icon: InstallIcon,
    title: 'Installs like a real app',
    body: 'Add it to your home screen for an app-like experience, with a true black dark mode built for OLED screens.',
  },
]

const STEPS = [
  { n: '1', title: 'Set your goal', body: 'Cut, maintain, or gain - tell it your stats and get real targets in under a minute.' },
  { n: '2', title: 'Log meals your way', body: 'Search, scan a barcode, describe it to AI, or reuse something you logged before.' },
  { n: '3', title: 'See what’s working', body: 'Watch your rings, trends, and streaks build up - and ask your coach when something looks off.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-slate-900 dark:bg-surface-dark dark:text-slate-100">
      <a href="#main-content" className="fixed -top-24 left-4 z-50 rounded-lg bg-white p-3 text-brand-700 focus:top-4">
        Skip to content
      </a>

      {/* Fully opaque, not translucent -- a backdrop-blur/opacity header's
          effective contrast depends on whatever's scrolled underneath it,
          which axe correctly can't guarantee passes at every scroll
          position. Every other surface in this app is opaque for the same
          reason. */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-surface dark:border-slate-800 dark:bg-surface-dark">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-lg dark:bg-brand-900/30" aria-hidden="true">
              🥗
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-400">Bitewise</span>
          </div>
          <Link
            to="/welcome"
            data-testid="landing-nav-signin"
            className="min-h-touch min-w-touch inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-400"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 lg:pb-24 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="mb-4 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-caption font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-400">
                Free food &amp; macro tracker
              </p>
              <h1 className="text-display font-bold leading-tight text-slate-900 dark:text-slate-100">
                Bitewise makes tracking food actually stick.
              </h1>
              <p className="mt-5 max-w-md text-body leading-relaxed text-slate-600 dark:text-slate-300">
                Log meals in seconds with AI, a barcode scan, or search - get calorie and macro
                targets built for your goal, and see your progress sync across every device.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/welcome"
                  data-testid="landing-cta-primary"
                  className="min-h-touch inline-flex items-center justify-center rounded-card bg-brand-700 px-6 font-medium text-white transition-transform active:scale-[0.98]"
                >
                  Get started - it&apos;s free
                </Link>
                <a
                  href="#features"
                  data-testid="landing-cta-secondary"
                  className="min-h-touch inline-flex items-center justify-center rounded-card border border-slate-300 px-6 font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  See what it can do
                </a>
              </div>
              <p className="mt-4 text-caption text-slate-500 dark:text-slate-400">
                No credit card. No ads. Skip sign-in and try it on this device right away.
              </p>
            </div>

            {/* Hero mockup: real dashboard components with illustrative numbers, not a static image. */}
            <div className="mx-auto w-full max-w-sm">
              <div className="rounded-card bg-white p-6 shadow-card dark:bg-surface-dark-card" aria-hidden="true">
                <p className="mb-4 text-caption font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Today
                </p>
                <div className="flex justify-center">
                  <CaloriesRing consumedKcal={1420} targetKcal={1800} />
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <MacroBar label="Protein" consumed={96} target={140} colorClass="bg-protein-500" testId="landing-mock-protein" />
                  <MacroBar label="Carbs" consumed={138} target={190} colorClass="bg-carbs-500" testId="landing-mock-carbs" />
                  <MacroBar label="Fat" consumed={42} target={60} colorClass="bg-fat-500" testId="landing-mock-fat" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-surface-dark-card lg:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-title font-bold text-slate-900 dark:text-slate-100">Everything you need, nothing you don&apos;t</h2>
              <p className="mt-3 text-body text-slate-600 dark:text-slate-300">
                A complete food diary built around how people actually eat - not a spreadsheet.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ Icon, title, body }) => (
                <div key={title} className="rounded-card border border-slate-200 p-5 dark:border-slate-700">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-400">
                    <Icon className="text-[20px]" />
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                  <p className="mt-1.5 text-caption leading-relaxed text-slate-600 dark:text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-title font-bold text-slate-900 dark:text-slate-100">Up and running in three steps</h2>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="text-center sm:text-left">
                  <span
                    className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 font-semibold text-white sm:mx-0"
                    aria-hidden="true"
                  >
                    {step.n}
                  </span>
                  <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">{step.title}</h3>
                  <p className="mt-1.5 text-caption leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust strip -- verifiable properties of the actual product, not testimonials/user counts. */}
        <section className="border-y border-slate-200 bg-brand-50 py-10 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-10 gap-y-4 px-5 text-center text-caption font-medium text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-2"><FlameIcon className="text-brand-700 dark:text-brand-400" /> Free to use</span>
            <span className="inline-flex items-center gap-2"><MicIcon className="text-brand-700 dark:text-brand-400" /> Voice, photo, and text logging</span>
            <span className="inline-flex items-center gap-2"><TargetIcon className="text-brand-700 dark:text-brand-400" /> No ads, ever</span>
            <span className="inline-flex items-center gap-2"><HeartIcon className="text-brand-700 dark:text-brand-400" /> Your data, always exportable</span>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 text-center lg:py-24">
          <div className="mx-auto max-w-2xl px-5">
            <h2 className="text-title font-bold text-slate-900 dark:text-slate-100">Start your diary today.</h2>
            <p className="mt-3 text-body text-slate-600 dark:text-slate-300">
              Set up your targets in under a minute - sign in to sync across devices, or try it on this device first.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to="/welcome"
                data-testid="landing-cta-final"
                className="min-h-touch inline-flex items-center justify-center rounded-card bg-brand-700 px-8 font-medium text-white transition-transform active:scale-[0.98]"
              >
                Get started - it&apos;s free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center text-caption text-slate-500 dark:text-slate-400 sm:flex-row sm:justify-between sm:text-left">
          <span>© {new Date().getFullYear()} Bitewise</span>
          <Link to="/welcome" className="min-h-touch min-w-touch inline-flex items-center justify-center text-brand-700 underline dark:text-brand-400 sm:justify-start">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  )
}
