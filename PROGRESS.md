# MacroDesi — Build Progress

Tracks phase-by-phase execution against `dev-plan-ai-agent.md`.

## Final summary (all 9 phases, 0–8: PASS)

MacroDesi is complete: an installable, offline-first PWA calorie/macro tracker with a 307-item
curated Indian food database, barcode scanning (camera + manual fallback, OFF/FDC lookup chain),
full logging (search/quick-add/recipes/templates), calendar history with weight trend charts,
CSV export, and a weekly adaptive-target system — built phase-by-phase with a gate (lint → tsc →
tests → build → E2E → bundle budget) enforced green before every commit.

- **Tests:** 182 unit/integration tests (98.87% line coverage on `src/domain/**`, well above the
  80% bar) + 26 E2E tests (Playwright, incl. a 9-scan WCAG 2.1 A/AA audit via axe-core) = **208
  tests, all green**.
- **Bundle:** 111 KB gz initial JS+CSS (budget 300 KB) — Recharts and ZXing route-lazy-loaded so
  neither is in the initial load.
- **Lighthouse** (desktop preset, `npm run build && npm run preview` + `npm run lighthouse`):
  Performance 100 / Accessibility 100 / Best Practices 100 / SEO 100.
- **Data safety:** a real (not hypothetical) Dexie v1→v2 migration — seed a v1-only database,
  reopen with the current schema, verify every table's data survives and the new index works.
- **9 commits**, one per phase, each gated green before the next started; two real bugs were
  caught and fixed along the way rather than worked around (a floating-point rounding bug in the
  goal engine's property test, and a solution-style-tsconfig trap that made `tsc --noEmit` silently
  check zero files — full details in each phase's section below).

## Phase 0 — Scaffold & CI Harness
- Status: **PASS**
- Built: Vite + React 18 + TS project; Tailwind CSS; `vite-plugin-pwa` (manifest + service worker,
  `generateSW`/`autoUpdate`); ESLint (flat-free `.eslintrc.cjs`, `@typescript-eslint`,
  `react-hooks`) + Prettier; Vitest + React Testing Library; Playwright against `vite preview`
  (port 4173); app shell renders "MacroDesi"; `PROGRESS.md` / `BLOCKED.md` templates; git repo
  initialized.
- Tests: 1 unit (App shell smoke), 3 E2E (page loads, manifest present & valid, service worker
  registers on preview build).
- Gate: `npm run lint && npx tsc --noEmit && npm run test -- --run && npm run build && npm run test:e2e`
  → **all green**.
- Notes: pinned React 18.3 / Vite 5 / ESLint 8 (not the create-vite defaults of React 19 / Vite 8 /
  oxlint) to match the fixed tech stack in the dev plan. PWA icon is a single SVG (`purpose: any` +
  `maskable`) rather than generated PNG raster set — sufficient for manifest validity; can be
  swapped for real app art later without code changes.

## Phase 1 — Food Database & Data Layer
- Status: **PASS**
- Built: `scripts/build-fooddb.ts` generates `public/fooddb.json` from a hand-curated dataset
  (`scripts/data/curatedFoods.ts`, **307 foods** — South Indian staples, chicken/fish/mutton/egg
  dishes, dals, vegetable curries, breads, snacks, sweets, beverages, dairy, fruits, nuts, and
  general/fitness basics), each with household portions, aliases, and per-100g macros. `kcal` is
  *derived* from `p/c/f` via Atwater factors (4/4/9) at build time (1-decimal precision) so every
  entry is exactly internally consistent — sidesteps the integer-rounding edge case that broke the
  15%-tolerance check on near-zero-kcal items like Black Tea. Dexie v1 schema
  ([db.ts](src/data/db.ts)) with all 8 tables from the spec (`profiles`, `targets`, `foods`,
  `recipes`, `logEntries`, `weighIns`, `scannedProducts`, `mealTemplates`) locked in now so later
  phases only ever *add* `.version()` blocks, never edit this one. Typed repos: `FoodRepo`,
  `LogRepo`. Fuse.js `FoodSearchService` (name/alias weighted, typo-tolerant).
  `npm run build:fooddb` wired as a `pretest`/`prebuild`/`prevalidate:fooddb` hook so the JSON is
  always regenerated fresh, and the generated file is also committed for `npm run dev`.
- Tests: 8 DB-integrity tests (count ≥300, kcal>0, macro consistency, ≥1 portion, positive grams,
  unique ids/names, category+source present) over the generated JSON; 19 search tests (alias
  matches, typo tolerance incl. multi-word "chiken biryani", empty query, and all 15 named
  top-result relevance assertions — passed without threshold tuning); 10 repo CRUD round-trip
  tests (`FoodRepo`, `LogRepo`) against `fake-indexeddb`. 38 unit tests total, all passing.
- Gate: standard block + `npm run validate:fooddb` → **all green**.
- Notes: nutrition values are plausible curated approximations "in the spirit of" IFCT-2017/INDB
  patterns, not a verbatim dataset export (no network/licensed-data access in this environment) —
  documented as such in the source file's header comment.

## Phase 2 — Onboarding & Goal Engine
- Status: **PASS**
- Built: [goalEngine.ts](src/domain/goals/goalEngine.ts) — Mifflin-St Jeor BMR → TDEE via activity
  multiplier → cut target = TDEE−500 floored at `max(BMR, 1500♂/1200♀)`, maintain = TDEE, gain =
  TDEE+300; protein 1.8 g/kg default (clamped 1.6–2.2), fat 0.7 g/kg floor, carbs = remainder.
  Single-page onboarding form ([OnboardingFlow.tsx](src/app/OnboardingFlow.tsx)) collecting
  name/sex/age/height/weight/activity/goal (goal defaults to "Lose fat" = cut); computes + persists
  Profile and an initial Targets row (`effectiveDate` = today, `source: 'computed'`). Minimal
  Dashboard showing the day's kcal/protein/carb/fat targets (ring/bars land in Phase 3). Settings
  page re-uses the same form to edit the profile and recompute targets. `ProfileRepo` (single-row
  upsert) and `TargetRepo` (`getLatest`/`getAll` by `effectiveDate`) added to the Phase 1 repo
  layer. App root redirects to `/onboarding` when no profile exists yet.
- Bug caught by the property test, fixed in code (not the test): `0.7 * 85` evaluates to
  `59.49999999999999` in IEEE754, which made `Math.round` truncate down to a mathematically wrong
  half-up result. Added a `round()` helper in `goalEngine.ts` that clears float noise via
  `toFixed(6)` before rounding — same fix needed anywhere grams-per-kg get multiplied out.
- Tests: 12 goal-engine unit tests — 7 hand-computed fixture personas (BMR-floor-binding sedentary
  male, no-floor very-active female, absolute-1200-floor low-bodyweight female, absolute-1500-floor
  low-bodyweight male, sedentary-vs-very_active pair, gain, maintain), 4 editable-range/floor
  clamp tests, 1 property test (500 seeded-random profiles asserting macro-kcal sum within ±2% of
  target and protein/fat never below floors). 6 new repo CRUD tests (`ProfileRepo`, `TargetRepo`).
  2 E2E tests: full onboarding journey for the "male/sedentary/cut" fixture persona asserting the
  dashboard shows the exact fixture numbers (1628 kcal / 126p / 171c / 49f, matching the unit-test
  fixture to the gram), and a reload-persistence check. 56 unit tests + 5 E2E total, all passing.
- Gate: standard block → **all green**.

## Phase 3 — Logging Core & Today Dashboard
- Status: **PASS**
- Built: Today dashboard (rebuilt on top of Phase 2's minimal version) with an SVG calories-ring
  (`CaloriesRing.tsx`), protein/carb/fat progress bars (`MacroBar.tsx`), and 4 meal sections
  (`MealSection.tsx`). Add-food flow (`AddFoodPage.tsx`): Fuse search over the seeded food DB (or
  browse Favorites/Recents/My Recipes when the query is empty) → pick a household portion or enter
  grams directly → live macro preview → save, with the same page doubling as the edit flow via
  `/log/edit/:entryId`. Custom quick-add (`QuickAddPage.tsx`, name + direct kcal/p/c/f, no food
  lookup) and a recipe builder (`RecipeBuilderPage.tsx`: search ingredients, enter grams per
  ingredient + servings, live per-serving preview, save). `LogEntry` now denormalizes `name` +
  `portionSummary` (in addition to the macros already denormalized in Phase 1) so the UI never
  needs N+1 food/recipe lookups to render history. Added `RecipeRepo`, favorite support on
  `FoodRepo` (`favorite?: boolean` field — no schema/index change needed, Dexie is schemaless
  beyond declared indexes), and `data/seed.ts` (`ensureFoodDbSeeded` — fetches `/fooddb.json`
  into IndexedDB exactly once; every subsequent read goes through IndexedDB, which is what makes
  search/logging work fully offline after the first load).
- Bug caught by switching from `npm run build` to relying on `npx tsc --noEmit` as the gate's
  type-check step: the create-vite scaffold's solution-style `tsconfig.json` (`files: []` +
  `references: [...]`) makes a bare `tsc --noEmit` silently check **zero files** and exit 0 even
  with blatant type errors — only `tsc -b` (build mode) actually walks the references. Verified
  this empirically by injecting a deliberate type error and watching `tsc --noEmit` pass anyway.
  Fixed by consolidating to a single non-referenced `tsconfig.json` covering `src`, `scripts`,
  and the two root configs, and changed `build` to `tsc --noEmit && vite build` (was `tsc -b`) so
  both paths now exercise the same real check. Re-ran every prior phase's suite afterward to
  confirm nothing had been silently broken — all still green. **Read this if reusing this dev
  plan's literal `npx tsc --noEmit` gate command on a create-vite-scaffolded project: check for
  this same solution-style tsconfig trap first.**
- Tests: 10 domain unit tests (portion math incl. the "2 idli + 1 katori sambar" fixture, recipe
  math). 1 integration test (log → totals update → edit qty → totals update → delete → totals
  revert, against `fake-indexeddb`, per spec). 6 new repo tests (`RecipeRepo` CRUD,
  `FoodRepo.favorite`, `seed.ts` fetch-once-then-IndexedDB-only behavior incl. a mocked-fetch
  failure case). 73 unit tests total. 4 new E2E tests: the full onboard → search "idli" → log 3
  idli + sambar journey asserting the ring/bars change by the exact expected amounts (1628 →
  1412 kcal remaining) plus reload persistence; offline logging with `context.setOffline(true)`
  after the one-time seed; edit-qty-then-delete updating the meal subtotal live. 8 E2E total, all
  green. Also manually verified visually via Playwright-captured screenshots of the onboarding
  form, empty dashboard (1628 kcal / 126p / 171c / 49f matching the fixture), search results,
  portion picker with live preview, and the logged dashboard (1587 kcal remaining after 1 idli) —
  the sandboxed interactive Browser pane couldn't reach localhost in this session, so screenshots
  via a throwaway Playwright script substituted for it.
- Gate: standard block → **all green** (73 unit + 8 E2E).

## Phase 4 — History, Calendar & Weight Tracking
- Built: Month-view calendar (`HistoryPage.tsx`) with day color coding — green ≤ target, amber ≤
  110%, red > 110%, and a 4th "none" state (grey) for days with no entries logged *or* no target
  yet in effect; future days render as disabled, unlinked cells (no future navigation). Tapping a
  day opens `DayDetailPage.tsx` (route `/history/:date`), which reuses `MealSection`/`MacroBar`
  from Phase 3 to read/edit/delete that day's log exactly like the Today view — `AddFoodPage` and
  `QuickAddPage` now accept a `date` query param (defaulting to today, clamped against future
  dates) so "add food" from a past day logs onto that day, not today. 7-day/30-day kcal averages
  shown on the History page. Weight log (`WeightPage.tsx`): date+weight form (date input capped at
  today), list of past weigh-ins, and a Recharts `LineChart` (first real use of Recharts) plotting
  raw weight plus a 7-day EMA trend line. New: `WeighInRepo`, `findApplicableTarget` (picks the
  `Targets` row with the latest `effectiveDate` <= a given date — so a day's color is judged
  against whatever goal was actually in effect that day, not today's goal), `classifyDay`,
  `computeAverage`/`groupEntriesByDate` (averaging skips unlogged days rather than zero-filling —
  callers only ever pass days that actually have entries), `computeEMA`, and `getMonthGrid`/
  `isFutureDate`/`addDaysISO` calendar-grid date utilities.
- Behavior worth flagging, not a bug: because `Targets.effectiveDate` is stamped at onboarding
  time, any day *before* a user's account existed shows "none" (grey), even if entries are
  logged there — there's genuinely no goal to compare against for a day before the goal existed.
  Confirmed this is intentional by seeding an earlier-dated target directly into IndexedDB in the
  E2E test to exercise the green→red transition meaningfully.
- Tests: 28 domain unit tests (11 color-band classification table incl. exact-target and
  exactly-110% boundaries; 4 EMA fixture-series incl. out-of-order input; 4 averaging incl. the
  "skip missing days, don't zero-fill" case; 4 target-for-date incl. order-independence; 5
  calendar-grid/date-guard, incl. a leap-year February). 4 new repo tests (`WeighInRepo`). 3
  integration tests seeding 10 calendar days (1 deliberately unlogged) against a single target and
  asserting every day's color band *and* that 7-day/30-day averages match hand-computed fixtures
  (2108.3 / 2061.1 kcal) — exactly the "seeded-history" gate spec calls for. 3 new E2E tests:
  navigate to a past day → edit an entry's quantity until it crosses from green to red → verify the
  calendar cell updates; future days are non-interactive; log a weigh-in and see the trend chart.
  11 E2E total. 108 unit tests total. Visually verified the calendar, day detail, and multi-point
  EMA weight chart via Playwright-captured screenshots.
- Known follow-up for Phase 8 hardening: Recharts pulled the gzipped bundle from ~104 KB to ~213
  KB (866 modules now transformed vs. 60 before) — comfortably over the <300 KB gz *initial* JS
  budget once Phase 6/7 add more code. `WeightPage` (and future chart-heavy pages) should be
  route-lazy-loaded (`React.lazy`) so Recharts isn't in the initial bundle; not fixed now since
  bundle budget is explicitly a Phase 8 gate item, not Phase 4's.
- Gate: standard block → **all green** (108 unit + 11 E2E).

## Phase 5 — Barcode Scanner (headline feature)
- Built: Scan screen (`ScanPage.tsx`) tries the native `BarcodeDetector` API first (polling
  `detect()` against the live video every 400ms), falls back to `@zxing/browser`'s
  `BrowserMultiFormatReader.decodeFromVideoDevice`, and — regardless of camera outcome, including
  when `getUserMedia` is denied/unavailable — always renders a manual barcode-number input as the
  accessibility/desktop fallback the spec calls for. Lookup chain (`lookupProduct.ts`): local
  `scannedProducts` cache (keyed by barcode, new `ScannedProductRepo`) → Open Food Facts v2 →
  USDA FDC branded search (only attempted if `VITE_FDC_API_KEY` is set) → not-found. A cache hit
  returns before any `fetch` call — that's what makes re-scanning a known product work offline.
  Not-found flow (`ScanNotFoundPage.tsx`): photo capture (`capture="environment"` file input) runs
  through the `LabelReader` interface — `VisionApiLabelReader` if a vision endpoint+key are
  configured, else `NullLabelReader` (always returns null, deferring to the manual form) — user
  fills in/confirms name + per-100g macros + optional serving size, saved to `scannedProducts`
  permanently (`source: 'manual'`). Serving picker (`servingOptions.ts`) synthesizes "1 serving",
  "1 pack", "½ pack" options from OFF's `serving_size`/`quantity` fields (falls back to a plain
  100g option); count-based portions like "2 biscuits" aren't derivable from OFF data without a
  per-unit weight, so the picker offers pack/serving grams instead, consistent with Phase 3's
  grams-override pattern. `LogEntry` gained an optional `barcode` field (denormalized, like
  `name`/`portionSummary` before it) so scanned items are traceable and — via new
  `LogRepo.getRecentBarcodes` — enter recents.
- Decode-function fixture testing without a camera: `@zxing/library`'s bundled `MultiFormatWriter`
  turned out to only support QR/DataMatrix/Aztec (its 1D barcode writers are commented out of this
  version's build — confirmed by inspecting the compiled source after `EAN13Writer`/`Code128Writer`
  calls all failed with "No encoder available"). Implemented the standard EAN-13 symbology directly
  (`ean13TestFixture.ts`: start/middle/end guards + L/G/R digit encodings) to render a real,
  decodable barcode image as a test fixture, verified against the well-known reference code
  `4006381333931` before relying on it. `decodeBarcode.ts` is the headless-testable core (raw
  luminance buffer → ZXing `MultiFormatReader` → text) that both the `BarcodeDetector` and ZXing
  video paths ultimately reduce to; the camera/video wiring itself isn't unit-testable and isn't
  exercised by these tests, matching the spec's own note that "camera can't run headless."
- Fixtures (`src/domain/barcode/fixtures/*.json`): hand-constructed, schema-accurate OFF v2 and FDC
  v1 responses (not live-captured — no network access in this environment) for an Amul product
  (butter, 500g pack / 10g serving), a Britannia product (cashew cookies), an OFF "product found but
  nutriments empty" response, an OFF "not found" response, and FDC branded-search hit/miss
  responses.
- Tests: 9 parser unit tests over the fixtures (Amul + Britannia full parse, graceful-null on empty
  nutriments — confirmed it doesn't throw — graceful-null on not-found, malformed-input safety) +
  4 FDC parser tests (incl. UPC leading-zero matching) + 4 serving-options tests (incl. per-serving-
  vs-per-100g math cross-checked against OFF's own reported per-serving values) + 6 decode-fixture
  tests (2 product-shaped barcodes, 1 varying bar-width/height, blank image, random noise, and a
  self-check of the fixture generator's check-digit math against the reference code) + 5
  LabelReader tests + 3 `ScannedProductRepo` CRUD tests + 1 new `LogRepo.getRecentBarcodes` test.
  7 integration tests (mocked fetch): cache-hit short-circuits network, OFF hit caches for next
  time, OFF-miss-then-FDC-hit chain order, FDC skipped entirely with no API key, both-miss →
  not-found, network error handled gracefully, and explicitly the spec's "not-found → manual save
  → second scan hits cache offline" scenario. 143 unit tests total. 2 new E2E tests (network mocked
  via Playwright routes, per spec, since camera can't run headless): manual entry → OFF hit → log
  it → dashboard total updates exactly; not-found → manual form → save → add → then fully offline
  (`context.setOffline(true)`) re-scan of the same barcode resolves from cache with zero network
  calls. 13 E2E total. Visually verified: camera gracefully reports "unavailable" and the manual
  entry path remains fully usable (expected in this sandboxed environment — no camera device);
  scanned-product page shows name/brand/source badge/portion picker/live preview correctly.
- Gate: standard block → **all green** (143 unit + 13 E2E).
- Known follow-up for Phase 8: `@zxing/library` + `@zxing/browser` added ~110 KB gz to the bundle
  (now ~325 KB gz total, up from ~213 KB after Phase 4) — `ScanPage` should be route-lazy-loaded
  alongside `WeightPage` before the bundle-budget gate.

## Phase 6 — Templates, Streaks, Reports, Export
- Built: Meal templates — "Save as template" on any non-empty meal section saves its
  foodId-based entries (schema-faithful: `MealTemplateEntry` is `{foodId, qty, unit}`, so
  recipe/custom-snapshot entries are skipped with a visible count in the UI) as a
  `MealTemplate`; `TemplatesPage.tsx` lists saved templates with a per-template meal selector and
  one-tap "Log now" that re-resolves the template against *current* food data (`applyTemplate.ts`)
  rather than replaying stale cached macros. Logging-streak counter (`computeStreak` — consecutive
  logged days ending today, or yesterday if today's still in progress so an unfinished day doesn't
  zero out the streak) and 30-day consistency score, both shown on the Dashboard and the new weekly
  Report page. Weekly report (`ReportPage.tsx` / `computeWeeklyReport`): avg kcal over the last 7
  logged days, protein-target hit-rate, best/worst day (smallest/largest absolute deviation from
  the kcal target). CSV export (`ExportPage.tsx`): logs and weigh-ins as separate downloads via
  Blob + a programmatically-clicked `<a download>`, built on a small RFC4180-style `csv.ts`
  (quotes/escapes commas, quotes, and newlines).
- A real bug the E2E tests caught in themselves, not the app: the CSV-export test originally lost
  its second logged entry every run. Root-caused by reproducing it in isolation — the test was
  calling `page.goto()` (a hard navigation) immediately after clicking "Add to Lunch," racing
  ahead of the in-flight `await logRepo.addEntry(...)` inside the click handler, since Playwright's
  `.click()` only waits for the click to dispatch, not for the app's resulting async work. Fixed
  by asserting `toHaveURL('/')` (which only becomes true once the save + `navigate()` actually
  completes) before any subsequent hard navigation — confirmed with a 3x repeat run. Documented
  here since the same pattern (hard nav right after a save-then-navigate action) would bite any
  future E2E test in this app.
- Tests: 11 streak unit tests (incl. gap-breaks-streak, today-in-progress-doesn't-break-streak,
  month- and year-boundary safety) + 3 weekly-report fixture tests + 8 CSV tests (comma/quote/
  newline escaping, empty-input header-only case) + 3 `applyTemplate` tests (the same "3 idli + 1
  katori sambar" fixture numbers as Phase 3, plus a gram-override case and an unknown-food-id
  error) + 2 `MealTemplateRepo` CRUD tests + 1 template integration test (save → resolve against
  seeded food data → verify the exact logged entries). 171 unit tests total. 2 new E2E tests: save
  a template, advance the clock a full day (`page.clock.setFixedTime`, confirming the fresh day
  starts empty) and one-tap log it, verifying the exact same kcal total lands on the new day; CSV
  export downloads two parseable files and asserts row counts (header + N) match what was actually
  logged. 15 E2E total.
- Gate: standard block → **all green** (171 unit + 15 E2E).

## Phase 7 — Adaptive Targets (smart layer)
- Built: weekly adaptive-target job (`adaptiveTargets.ts`) that runs automatically on app open
  (`AdaptiveTargetPrompt.tsx`, mounted on the Dashboard). Algorithm: `impliedTDEE = meanLoggedKcal
  - (weeklyWeightChangeKg × 7700) / 7` (the standard energy-balance identity — infers a person's
  *actual* maintenance calories from what they really ate vs. what their weight really did, rather
  than trusting the Mifflin-St Jeor estimate forever), `idealTarget = impliedTDEE - 550` (550 =
  the daily deficit for a 0.5 kg/week loss goal), adjustment = `idealTarget - currentTarget`
  clamped to ±100 kcal, and the resulting suggested target is floored via the same
  `computeKcalFloor` (newly exported from `goalEngine.ts`) Phase 2's `computeGoalTargets` uses
  internally — so an accepted adaptive nudge can never drop below the user's BMR/1500/1200 floor.
  Requires a full 7 distinct logged days *and* ≥2 weigh-ins inside that trailing window, else
  returns `null` (no-op) rather than guessing from partial data. Every non-zero-adjustment result
  carries a human-readable "why" (e.g. "You lost 1.0 kg over the last 7 days — faster than your
  0.5 kg/week goal, so we're raising your target by 100 kcal to keep this sustainable."). Accept
  writes a new `Targets` row (`source: 'adaptive'`, carbs absorb the kcal change, protein/fat grams
  held steady since adaptive nudges are about calorie balance, not body-composition goals); Dismiss
  records a one-week suppression in `localStorage` so the same week's suggestion doesn't nag again
  on every app open — a reasonable place for this since it's ephemeral UI state, not core data
  worth a new Dexie table/version bump.
- Tests: 8 unit-fixture tests (losing-too-fast → raised +100, plateau → lowered -100, two
  insufficient-data no-op cases — <7 logged days and <2 weigh-ins — floor respected even when the
  unclamped math would go lower, a distinguishing case proving the formula uses *actual* logged
  intake rather than just chasing the weight-trend rate, an exact-0.5kg/week on-track case with
  zero adjustment, and weigh-ins outside the 7-day window being correctly ignored). 1 integration
  test seeding a real 3-week dataset (fake-indexeddb) and running the job 3 times with each week's
  accepted target feeding the next, asserting the *exact* sequence `[1728, 1628, 1628]` — raised,
  lowered, held — per the gate spec. 181 unit tests total. 2 new E2E tests seeding 7 days of
  plateau data directly into IndexedDB (mirroring Phase 4's target-seeding pattern, since
  constructing a week of history through the UI would be impractical): the prompt shows the
  correct suggestion and reason text, accepting updates the visible kcal target and the prompt
  doesn't reappear on reload; dismissing hides it and it stays hidden across a reload without
  changing the target. 17 E2E total. Visually verified the prompt's copy and layout.
- Gate: standard block → **all green** (181 unit + 17 E2E).

## Phase 8 — Hardening & Release
- **Error boundaries:** class-based `ErrorBoundary` wraps the whole route tree — an unhandled
  render error now shows a "your data is safe on this device, try reloading" screen instead of a
  blank white page, with the actual error logged to the console for diagnosis.
- **Empty states:** audited every page; the one real gap was `MealSection` rendering a blank white
  card with zero explanation when a meal had no entries — added "Nothing logged yet." All other
  pages (Templates, Weight, Report, RecipeBuilder, AddFoodPage search) already had empty-state
  copy from their originating phase.
- **a11y pass:** installed `@axe-core/playwright` and wrote `e2e/a11y.spec.ts`, a real automated
  WCAG 2.1 A/AA scan (not a manual eyeball pass) across onboarding, dashboard, add-food, history,
  weight, templates, report, settings, and scan — 9 pages. First run found genuine violations:
  `text-slate-400` (the muted/secondary-text color used everywhere) is 2.45–2.56:1 against white
  and slate-50, well under the 4.5:1 AA minimum for normal text — fixed by switching the whole app
  to `text-slate-500` (verified 4.76:1 on white via manual contrast calc before the sed). Two more
  violations survived that first pass: the calendar's disabled future-day cells used `opacity-40`,
  which multiplies the *effective* rendered contrast down regardless of the base color (1.63:1,
  badly failing) — fixed by dropping opacity entirely in favor of an explicit lighter
  background+darker text combo (`bg-slate-50 text-slate-600`, 7.24:1); and the "no data" calendar
  band (`bg-slate-100 text-slate-500`, 4.34:1) and amber "over 100%" band (`text-amber-700` on
  `bg-amber-100`, 4.51:1 — passing but with almost no margin) were bumped to `text-slate-600`
  (6.92:1) and `text-amber-800` (6.37:1) for real safety margin, not just a bare pass. All 9 pages
  now scan **zero violations**.
- **Bundle budget:** `WeightPage` (Recharts) and the three `Scan*` pages (`@zxing/library` +
  `@zxing/browser`) are now `React.lazy()` + `Suspense` route chunks instead of being in the
  initial bundle — dropping initial JS+CSS from ~329 KB gz (flagged as a known issue after Phases
  4 and 5) to **111 KB gz**, comfortably under the 300 KB budget. `scripts/check-bundle.ts` parses
  `dist/index.html` for the `<script>`/`<link>` tags it references directly (i.e. what a first
  visit actually has to download — lazy chunks fetched later on navigation don't count) and gzips
  each to verify the total, wired into `npm run check:bundle`.
- **Dexie migration test:** every table's indexes were already fully specified in the Phase 1 v1
  schema, so nothing had actually *needed* a migration yet — added a genuine, useful v2 (indexing
  `barcode` on `logEntries`, which was an unindexed plain field since Phase 5, so "recently
  scanned" lookups can use the index instead of a full scan) specifically to have a real migration
  to test. `db.migration.test.ts` opens a raw Dexie instance with *only* the v1 schema, seeds one
  row in every table, closes it, reopens with the real `MacroDesiDB` class (v1+v2), and asserts
  every table's data survived intact *and* the new index actually returns correct results (not
  just "didn't crash").
- **Final Lighthouse checks:** installed `lighthouse` + `chrome-launcher` as dev dependencies
  (`npm run lighthouse`, documented in the README) and ran a real desktop-preset audit against
  `npm run preview`. First run: Performance 100, Accessibility 100, Best Practices 100, **SEO 91**
  — `robots-txt is not valid`, because there was no `public/robots.txt` and `vite preview`'s SPA
  fallback was serving `index.html` (HTML, not a valid robots.txt) for that path. Added a minimal
  permissive `public/robots.txt`; re-run scored **100/100/100/100**. This script isn't wired into
  the automated gate (matches the dev plan's literal final gate command, which doesn't include
  it, and a full Lighthouse run is slow/flakier than the other checks) — it's a documented,
  manually-invokable verification instead.
- **Deploy config + README:** `vercel.json` (rewrites), `netlify.toml` (build + redirect), and
  `public/_redirects` (Netlify-format fallback that Cloudflare Pages also reads, copied into
  `dist/` automatically since it's under `public/`) all route every path to `index.html` — needed
  because React Router's client-side routing means a hard reload on e.g. `/history` has no
  server-side route to match otherwise. README expanded with concrete per-platform deploy steps,
  the Lighthouse workflow, and the full final gate command including `--coverage` and
  `check:bundle`.
- **Coverage:** added `@vitest/coverage-v8`, configured `include: ['src/domain/**']` with an
  80%-lines threshold in `vite.config.ts`. Actual: **98.87% lines** (98.87% statements, 90.71%
  branches, 98.46% functions) — the only real gaps are a couple of unreachable defensive
  `catch`/fallback branches in the barcode parsers and label reader, which is expected for
  error-handling code paths that only trigger on malformed external API responses.
- Tests added this phase: 9 a11y E2E tests (0 violations after fixes) + 1 Dexie migration test.
  Combined with everything from Phases 0–7: **182 unit tests, 26 E2E tests, 208 total, all green**.
- Gate (final): `npm run lint && npx tsc --noEmit && npm run test -- --run --coverage && npm run
  build && npm run test:e2e && npm run check:bundle` → **all green**. Build is deployable
  (verified static output + SPA-rewrite configs for all three named targets).

---

# Phase 9 — UX/UI Polish (`ux-polish-spec.md`)

A second spec, handed over after the original 9-phase build shipped, asking for a full navigation
and interaction-model redesign (bottom-tab shell, FAB + bottom sheets, animated summary card,
swipe-to-delete, motion system, dark mode, a full a11y/touch-target pass). Executed as its own
set of gated sub-phases (9A–9F) on top of the existing app, same protocol as Phases 0–8.

## 9A — Design Tokens
- `src/theme/tokens.ts` is the single source of truth (brand #0F9D58 50→900 scale; macro colors
  protein/carbs/fat matching Tailwind's violet-600/amber-500/sky-500 exactly per spec; semantic
  success/warn/danger; surface + dark-mode mirror; type scale; 4px spacing scale; 44px touch
  target; motion timings). `tailwind.config.ts` (renamed from `.js`) imports directly from it —
  Tailwind CSS 3.4+ loads TS configs natively, so there's no build-time duplication step.
- `npm run check:tokens` (`scripts/check-tokens.ts`) fails the gate on any raw hex color under
  `src/app/**/*.tsx` — the spec's literal `src/components/**` path doesn't exist in this
  codebase's structure, so the check was pointed at the actual component tree instead. Fixed the
  5 pre-existing raw-hex usages (`CaloriesRing`/`WeightPage`'s SVG and Recharts `stroke` props,
  which take JS values, not Tailwind classes) to import from `tokens.ts`.
- **Real accessibility regression caught by the existing axe suite**: the spec's literal
  brand-600 (`#0F9D58`) is only 3.5:1 against white — fine for large/graphical elements but fails
  WCAG AA's 4.5:1 text minimum, and `brand-600` was used via Tailwind classes as both link-text
  color and white-button-label background on *every single page* (every "Back" link, every
  primary button). All 9 a11y-scanned pages failed immediately after the token swap. Fixed by
  moving every text/button usage to `brand-700` (5.13:1) app-wide, reserving `600` for non-text
  graphical fills (ring stroke, etc.) — confirmed by re-running the full a11y suite back to zero
  violations. This is exactly the kind of thing a literal spec value can get wrong; the axe gate
  is what caught it, not manual review.
- Tests: 6 new token-value regression tests. 188 unit + 26 E2E, all green.

## 9B — App Shell & Navigation
- Installed `framer-motion` for gesture/animation primitives (drag-to-dismiss sheets, swipe
  navigation, spring transitions, built-in `useReducedMotion()`) rather than hand-rolling touch
  math — ~40KB gz, well inside the bundle's remaining headroom (111→154KB gz of a 300KB budget).
- New persistent shell (`src/app/shell/`): `Header.tsx` (wordmark + streak chip, tappable to
  `/trends` + avatar-initial circle, tappable to Settings — replaces the old "Hi {name}" text
  link), `BottomTabBar.tsx` (Today · History · **Scan FAB** (elevated, brand-filled, center) ·
  Trends · Settings — 44px+ touch targets, `env(safe-area-inset-bottom)` padding, active state =
  brand-700 + filled icon), `BottomSheet.tsx` (generic drag-to-dismiss bottom-drawer primitive:
  backdrop click / Escape / drag-down-past-threshold-or-velocity all dismiss; focus-managed;
  `role="dialog"`; respects `prefers-reduced-motion` by zeroing the spring transition), and
  `UIStateContext.tsx` (global sheet-open state + a `dataVersion` counter that bumps whenever a
  sheet saves an entry, so any page showing today's log — Dashboard, Header's streak count — knows
  to re-fetch without a page reload).
- FAB behavior matches spec exactly: tap → `AddFoodSheetContent` (search with recents/favorites/
  recipes, defaulting to a time-of-day-guessed meal) opens as a bottom sheet; a barcode icon in
  the sheet's search row jumps to the full-screen scanner. Extracted the food-selection glue
  (`per100gOf`/`nameOf`/`portionsOf`) into `src/app/foodSelection.ts` so `AddFoodPage` (still used
  for the edit-existing-entry flow via `/log/edit/:id`) and the new sheet share one implementation
  instead of drifting.
- **Today gained real date navigation**: `DateNav.tsx` ("Today, Aug 18" / "Yesterday, Aug 17" /
  "Wed, Aug 12" centered, with ‹ › chevrons, next-day disabled once it would be a future date) plus
  horizontal swipe-to-navigate on the page body (`framer-motion` `drag="x"` with `touch-pan-y` so
  vertical scroll still passes through) and a "Return to today" pill when viewing a past day.
  Dashboard now reads `date` from a query param (defaulting to today) and looks up the target that
  was actually in effect that day (`findApplicableTarget`, reused from Phase 4) rather than always
  showing today's target.
- Footer link row and "+ New recipe" removed from Dashboard per spec. Consolidated **Trends**
  (new tab) = `WeightSection` + `ReportSection`, extracted from the old standalone `WeightPage`/
  `ReportPage` (kept alive at their original routes too, for backward compatibility with existing
  tests/deep-links — they just render the same extracted sections now, no logic duplicated).
  Templates/Export/Settings/History/past-day-detail all moved inside the shell (header + tab bar
  now wrap them); Onboarding, the add/edit/scan/recipe-creation/template-creation flows stay
  full-screen outside the shell (standard mobile pattern: primary destinations keep chrome, modal-
  ish task flows don't).
- A second real bug caught by testing, not spec-reading: `Header`'s streak chip only fetched once
  on mount, so it silently went stale after logging via the new sheet (no full page reload to
  trigger a re-fetch anymore). Caught by actually looking at a captured screenshot after a sheet
  save, not by the automated suite — fixed by subscribing `Header` to the same `dataVersion` signal
  Dashboard uses.
- Tests: 5 new E2E tests (tab bar navigates all 4 non-FAB tabs; FAB opens the sheet and a
  successful log closes it *and* updates the total without a reload; the sheet's own close button
  dismisses without saving; past-day "Return to today" pill appears/returns correctly; the sheet's
  barcode icon opens `/scan`). Updated one Phase-2-era E2E assertion that checked for the now-
  removed "Hi {name}" text (replaced with the avatar-initial testid) — legitimate UI evolution,
  not a regression. 188 unit + 31 E2E, all green, zero a11y violations across all 9 scanned pages.
- Gate: `lint && tsc --noEmit && check:tokens && test && build && test:e2e` → all green. Bundle:
  153.69 KB gz initial (budget 300 KB).
