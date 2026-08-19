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

## 9C — Summary Card
- Ring rebuilt to spec: `src/domain/ring/ringState.ts` is a pure function (`computeRingState`)
  mapping `(consumedKcal, targetKcal)` → `{ band, centerText, subLabel, fillPct }`, unit-tested in
  isolation (7 cases: under/at/over target, rounding, zero-target no-div-by-zero, zero-consumed,
  fillPct clamped). `CaloriesRing.tsx` consumes it twice — once against the raw (unanimated) totals
  to drive the SVG stroke's fill/color via `framer-motion`'s own `animate` transition (450ms
  `cubic-bezier(0.22,1,0.36,1)`, 8px stroke, rounded caps), and once against a RAF-driven count-up
  value (`useCountUp`, 300ms ease-out-quint, `useReducedMotion`-aware) to drive the center text —
  so the number always animates smoothly toward its target regardless of whether it's counting down
  ("remaining") or up ("+n over"), and both converge to the same value once the count-up finishes.
  Over-budget (`remaining < 0`) turns the ring `semantic.warn` (amber) instead of `semantic.success`
  (brand green) and swaps the center text to `+n` / "over". Below the ring, a new Eaten/Remaining/
  Target row (`tabular-nums`) per spec; the ring itself carries `role="img"` + a full-sentence
  `aria-label` ("200 of 1628 calories remaining" / "…, +372 over").
- Macro bars rewritten to animate `scaleX` on a fixed-width transformed layer (not `width`, per the
  spec's 60fps transform-only rule) — `MacroBar.tsx`. Fixed the spec's named "floating-dot bug"
  (a real percentage-based scale can shrink a small-but-nonzero value down to an invisible sliver)
  by flooring the scale at `MIN_VISIBLE_SCALE = 0.025` whenever `consumed > 0`, so any logged amount
  stays visibly represented. Bars are now tappable (`onTap`, 44px min-height button when a handler
  is supplied) and open a new per-meal breakdown sheet.
- `src/domain/logging/macroBreakdown.ts` (`computeMacroBreakdown`, pure, unit-tested — 3 cases:
  normal split across meals, all three macros, all-zero/no-entries) + `MacroBreakdownSheet.tsx`
  (built on the existing `BottomSheet` primitive) show a per-meal gram breakdown with a total row
  when a bar is tapped.
- Self-caught bug, before any test ran: the first draft of the ring only animated the center number
  for the over-budget case (`eaten - target`) and left the normal case reading straight off the
  static `computeRingState` result, so "remaining" never counted up while "+n over" did. Fixed by
  the dual-`RingState` split described above before it ever reached a test run.
- Tests: 10 new unit tests (`ringState.test.ts` ×7, `macroBreakdown.test.ts` ×3) — 198 unit tests
  total, all green, no regressions in the existing 31 E2E specs despite the full rewrite of both
  components (confirms `kcal-remaining`, `*-bar-value`, and `targets-card` testids/formats held).
  Added 3 new E2E tests (`e2e/summaryCard.spec.ts`): over-budget turns the ring amber and shows
  "+n over" (asserted against both the rendered text and the SVG `stroke` attribute), under-target
  stays brand-colored with a full-sentence accessible name, and tapping a macro bar opens the
  breakdown sheet with the correct per-meal grams and total. 34 E2E specs total, all green.
- Gate: `lint && tsc --noEmit && check:tokens && test && build && test:e2e` → all green. Bundle:
  154.73 KB gz initial (budget 300 KB, no new dependency weight — `framer-motion` was already
  counted in 9B).

## 9D — Meal Sections
- `formatPortion()` (`src/domain/logging/formatPortion.ts`) renders logged portions in household
  units — "3 idli", "1½ idli", plain "313 g" for the barcode-scan 100g fallback — instead of the
  old raw `"{qty} x {portion.label}"` string (which could read as "3.13 x 100 g", exactly the
  pattern the spec called out to eliminate). It works off a new `portionLabel` field added to
  `LogEntry` (the picked portion's raw label, e.g. "1 idli") alongside the existing denormalized
  `portionSummary` string — `portionSummary` is left alone for CSV export / template listings,
  `portionLabel` is the new structured input `formatPortion()` needs to reconstruct natural
  language. Wired into every entry-creation site (`AddFoodPage`, `AddFoodSheetContent`,
  `ScanProductPage`, `applyTemplate`); quick-add/custom entries render as "Custom entry" via an
  explicit flag rather than a fragile "0 g" fallback. 14 unit tests.
- Meal cards rebuilt end to end (`MealSection.tsx`): header now carries a subtotal + an overflow
  (⋯) button opening `MealOverflowSheet` (Save as template / Log template — a second-level list of
  saved templates, applied via the existing `applyTemplate` domain fn / Copy from yesterday — clones
  the prior day's entries for that meal via a new pure `buildCopiedEntries()` transform). Rows are
  now a single tappable button (`aria-label="Edit {name}"`, navigates to the existing edit routes)
  wrapped in a new `SwipeToDeleteRow` — no more permanent inline "Edit"/"Delete" text links. The
  old four-link footer ("+ Add food" / "+ Custom" / "Scan barcode" / "Save as template") collapsed
  into a single 44px ghost "+ Add" button that opens the same FAB sheet from 9B, scoped to that
  meal; a new "Enter calories manually" link inside the sheet (`AddFoodSheetContent`) keeps
  quick-add reachable now that MealSection no longer links to `/log/quick-add` directly, and the
  sheet's existing barcode icon keeps scan-to-log reachable, so no functionality was lost — it's
  parented under the search sheet instead of a per-meal link row per DayDetailPage/Dashboard's own
  "+Add" (past-day view keeps the full-screen `/log/add` route, since the sheet only knows how to
  log to *today*).
- **Smart empty states**: before a meal's first log of the day, `computeMealSuggestions()` (pure,
  domain-level) scans the trailing 14 days of that meal slot for the most-repeated exact food+qty
  combo (grouped by day, ranked by recurrence count then recency) and surfaces up to 2 one-tap
  chips ("3 Idli + Sambar"); meals with no repeat history fall back to meal-specific empty copy
  ("Nothing for breakfast yet."). Tapping a chip resolves each food's *current* per-100g values
  against the *historical* grams (so a repeat log reflects any food-DB updates but the same
  portion), reusing `formatPortion()` for the new entries' display text. 10 seeded-history unit
  tests.
- Swipe-to-delete (`SwipeToDeleteRow.tsx`, framer-motion `drag="x"`) is optimistic-delete-then-undo,
  not a deferred delete: swiping past -80px immediately calls the same `onDelete` the row's edit
  button used to trigger via a link, then shows a 5s `Snackbar` ("Deleted {name} · Undo") whose
  Undo action just re-`addEntry()`s a snapshot of what was removed — reusing the already-tested
  delete pipeline in both directions instead of inventing a separate "pending" state machine that
  has to stay in sync with the ring/macro-bar totals during the undo window.
- **Two real gesture bugs found only by getting swipe-to-delete under an actual (non-mocked)
  pointer sequence, not by unit tests**: (1) the Today dashboard already wraps its body in a
  horizontal `drag="x"` for date-swipe navigation (9B); a row's own `drag="x"` nested inside it
  competes for the same framer-motion axis lock on every pointerdown, and the *page's* swipe can
  silently win the race and swallow the row's gesture instead of deleting it — fixed by calling
  `stopPropagation()` on the row's own `onPointerDown` so the gesture never reaches the ancestor.
  (2) A real swipe's `pointerup` fires the browser's native `click` on the row's nested edit button
  *before* framer-motion's own `onDragEnd` callback resolves (it's scheduled through Framer's
  internal frame queue, not synchronous with the DOM event) — so a naive "check drag distance in
  onDragEnd" guard is already too late to stop the click, and a delete swipe was immediately
  followed by a spurious navigation to the (just-deleted) entry's edit screen. Fixed by tracking
  "did this pointer sequence move" live during `onDrag` (which does fire before pointerup) in a
  ref, and swallowing the subsequent click in an `onClickCapture` on the same element. Both were
  invisible to any assertion that only checks pre/post state — they only showed up once the actual
  event sequence was reproduced and traced end to end.
- Tests: 30 new unit tests (`formatPortion.test.ts` ×14, `suggestions.test.ts` ×10,
  `copyEntries.test.ts` ×6) — 228 unit tests total, all green. 5 new E2E specs
  (`e2e/mealSections.spec.ts`): household-unit portion display, overflow menu present on all 4
  meals, swipe-delete + undo restores the entry and totals, copy-from-yesterday, and log-via-
  suggestion-chip (seeded 14-day history). Updated existing E2E specs across `barcode.spec.ts`,
  `history.spec.ts`, `logging.spec.ts`, `templates-and-export.spec.ts`, and `summaryCard.spec.ts`
  for the removed footer links/Edit-Delete links — legitimate UI-evolution updates, not
  regressions (same pattern as every prior sub-phase). 39 E2E specs total, all green (verified
  stable across two consecutive full runs). E2E swipe-gesture tests dispatch real `PointerEvent`s
  directly via Playwright's `locator.dispatchEvent()` rather than simulating raw OS mouse
  coordinates, which proved unreliable at reproducing framer-motion's drag-recognition window in a
  headless browser.
- Gate: `lint && tsc --noEmit && check:tokens && test && build && test:e2e` → all green. Bundle:
  157.38 KB gz initial (budget 300 KB).

## 9E — Motion & Feel
- **Screen transitions**: `PageTransition.tsx` wraps the shell's `<Outlet/>` in an
  `AnimatePresence mode="wait"`, keyed by `location.pathname`, fading/sliding (8px) between tabs
  over the shared `motion.screenTransitionMs` (200ms) token — collapses to a plain opacity fade
  with `useReducedMotion`.
- **Count-up everywhere a running total changes**: the ring's center number already counted up
  (9C) via `useCountUp`; meal subtotals (`meal-subtotal-{meal}`) now use the same hook (300ms),
  so logging/deleting/copying/undoing a meal's items animates its kcal total instead of snapping.
- **FLIP list animations**: each meal's entry rows are wrapped in `AnimatePresence` +
  `motion.div layout` (fade+height, 200ms) in `MealSection.tsx` — adding an entry (search, template,
  suggestion chip, copy-from-yesterday) grows it in, removing one (swipe-delete) shrinks it out, and
  surrounding rows reflow smoothly instead of jumping.
- **Haptics**: `src/lib/haptics.ts` (`vibrateTiny`, feature-detected `navigator.vibrate(10)`) fires
  on every successful log (`AddFoodSheetContent`, `AddFoodPage`, `QuickAddPage`, `ScanProductPage`,
  and MealSection's suggestion-chip/template/copy-from-yesterday paths) and on the swipe-delete
  undo action.
- **Skeleton loader**: `DashboardSkeleton.tsx` mirrors the loaded Today page's exact shape (date
  nav, ring, three macro bars, four meal cards) using `motion-safe:animate-pulse` blocks — reserves
  the same heights as the real content so nothing shifts once data arrives, and collapses to static
  grey blocks under `prefers-reduced-motion` (Tailwind's `motion-safe:` variant, not a custom check).
- **Dark mode** — the largest piece of this sub-phase: `ThemeContext.tsx` (`light`/`dark`/`system`
  preference, `localStorage`-persisted, resolved against `matchMedia('(prefers-color-scheme:
  dark)')` with a live listener while on "system") applies/removes a `dark` class on
  `<html>`; an inline blocking script in `index.html` mirrors the same resolution logic to set that
  class *before first paint*, avoiding a light-then-dark flash. A 3-way toggle lives in Settings
  (`data-testid="theme-option-{light,dark,system}"`). `tailwind.config.ts`'s `darkMode: 'class'`
  and the `surface-dark`/`card-dark` tokens were already in place from 9A — this phase is what
  actually *uses* them: `body`'s default text/background (`src/index.css`) got `dark:` variants,
  which alone fixed every plain, unstyled paragraph/span across the app (most pages rely on that
  inherited default rather than an explicit color class), and every explicit `bg-white`/
  `text-slate-*`/`border-slate-*`/`divide-slate-*` class across `src/app/**` got a paired `dark:`
  variant (dark-mode text mapping: slate-800/900→slate-100, slate-600/700→slate-200/300,
  slate-500→slate-400 — the same "shift one notch lighter" pattern needed to hold 4.5:1 against the
  dark card background, computed and verified the same way as the 9A brand-600→700 fix). Framer's
  own `stroke`/`fill` SVG props (the ring's background track, `WeightSection`'s Recharts grid/axis/
  tooltip colors) aren't reachable by Tailwind's `dark:` variant at all, so those read
  `resolvedTheme` from `useTheme()` directly and pick a token color in JS.
- **A real contrast bug the dark-mode a11y scan caught, not manual review**: `text-brand-700` (the
  5.13:1-on-white color chosen in 9A specifically for text) is only 3.24:1 against the dark card
  background (`#132119`) — fails 4.5:1. It was used bare, with no dark override, in 14 files (every
  "← Back" link, several buttons) and `text-red-600`/`text-red-700` (delete/error text) had the same
  problem in 9 more (2.58–3.45:1 against the dark card). Fixed by pairing every bare occurrence with
  `dark:text-brand-400` (10.74:1) / `dark:text-red-400` (6.03:1) app-wide. Caught by the new
  dark-mode axe scan on the Add Food sheet — the light-mode a11y suite (still fully green) could
  never have caught this since the failure only exists once the dark palette is active, which is
  exactly why 9E adds its own dark-mode a11y coverage rather than trusting the existing light-mode
  scans to generalize.
- **Two real framer-motion gesture bugs found only by reproducing the actual event sequence**,
  while first building 9D's swipe-to-delete and now touched again for FLIP: documented in the 9D
  section above; the FLIP work here reused the same `SwipeToDeleteRow` unchanged; noted here because
  the fixes (drag-axis `stopPropagation`, live `onDrag`-based click suppression) are why the new FLIP
  animations and the pre-existing swipe gesture continue to coexist correctly on the same row.
- Tests: `resolveTheme.test.ts` (3 cases — explicit dark/light always win, "system" defers to the OS
  flag), `haptics.test.ts` (2 cases — calls `navigator.vibrate(10)` when available, no-ops/no-throw
  when the API is absent), and a reduced-motion pair for `useCountUp` split across two files
  (`useCountUp.reducedMotion.test.tsx` / `useCountUp.normalMotion.test.tsx`) — framer-motion caches
  its OS-preference detection once per module load, so the two preference states needed separate
  module registries (separate test files) rather than one file toggling a mock mid-suite, which is
  the same "isolation" reasoning documented for the E2E gesture-dispatch fix above, one layer down
  the stack. 235 unit tests total (+7), all green. New `e2e/darkMode.spec.ts` (4 specs): toggle
  persists across reload (and across a full page navigation, and back to Light), 0 axe violations
  on the dashboard/Settings/Add-Food-sheet in dark mode. 43 E2E specs total, all green (verified
  stable across three consecutive full runs — one transient "element outside viewport" failure
  during development was confirmed as parallel-worker timing flakiness, not a real regression, by
  reproducing it 3x in isolation with zero failures).
- Gate: `lint && tsc --noEmit && check:tokens && test && build && test:e2e` → all green. Bundle:
  159.31 KB gz initial (budget 300 KB) — no new runtime dependency; the CSS bump (+0.15KB gz) is
  from the doubled `dark:` variant classes.

## 9F — Accessibility Pass & Final Gate
- **Touch-target audit** (`e2e/touchTargets.spec.ts`, new, 8 specs): asserts every visible
  interactive element on a 390×844 viewport is ≥44×44px — buttons, links, inputs/selects directly,
  and radio/checkbox inputs via their enclosing `<label>` (the real tap target for a small native
  control). Covers onboarding, Today, the Add-Food sheet, History, Trends, Settings, Templates, Scan.
  First run found real violations, all fixed by padding (not size hacks, per spec): every "← Back"
  link across 14 pages was a bare 20px-tall inline text node — given `min-h-touch` +
  `inline-flex items-center` so the *hit area* grows via padding while the visual text stays the
  same size; the same fix went on Settings' Save/Done buttons, History's Prev/Next/Weight-tracking
  links, and the Sex/Goal radio `<label>`s in Settings and Onboarding; every text `<input>`/`<select>`
  across 11 files got `min-h-touch`. History's calendar grid (7 columns in a `max-w-md` card) was the
  one case padding alone couldn't fix without a real layout change — trimmed the calendar card's
  horizontal padding (`p-4` → `px-1 py-4`, with the padding moved onto the nav-row/weekday-row
  individually so they keep their visual alignment) to give each day cell enough width to clear 44px
  edge-to-edge.
- **Heading order**: axe's `heading-order`/`page-has-heading-one` rules are tagged `best-practice`
  in axe-core, not `wcag2a`/`wcag2aa` — meaning the a11y suite's existing WCAG-tagged scans (all
  green throughout this phase) would never have caught a missing or out-of-order heading. Ran both
  rules explicitly across every route as a one-off diagnostic and found two pages with no `<h1>` at
  all: the Today dashboard (jumps straight to meal-card `<h2>`s) and Trends (jumps straight to
  "Weight"/"This week" `<h2>`s) — both now have a `sr-only` `<h1>` ("Today" / "Trends") so the page
  has a real top-level landmark for screen-reader users without changing anything visually. Diagnostic
  confirmed zero violations across all 9 routes after the fix; not kept as a permanent gate script
  since best-practice rules aren't part of this repo's WCAG A/AA gate contract, and the two gaps
  found are now just fixed in the markup.
- **Focus-visible / icon-button labels / secondary-text contrast**: audited rather than rewritten —
  no component sets `outline-none` on a real interactive element (the one occurrence, on
  `BottomSheet`'s programmatic `tabIndex={-1}` focus-trap container, is correct as-is: it's never a
  tab stop, so it has no focus ring to suppress); every icon-only button already carries an
  `aria-label` (barcode scan, prev/next day, close, meal overflow ⋯, FAB) or sits next to a visible
  text label (bottom tab bar); secondary text contrast in both themes was already driven to 4.5:1 in
  9A (light, Phase 8 grey-400→600 sweep) and 9E (dark, this phase's brand-700/red-600 fix) — the
  full a11y + dark-mode a11y suites (0 violations across 13 scanned page/theme combinations) are the
  actual verification for this, not a new check.
- Tests: 8 new E2E specs (`touchTargets.spec.ts`). No new unit tests this sub-phase — 9F is a
  verification/audit pass over existing UI, not new logic. 235 unit tests (unchanged), 51 E2E specs
  total (+8), all green, verified stable across two consecutive full runs. Zero serious/critical axe
  violations across every scanned page in both themes (13 page/theme combinations across
  `a11y.spec.ts` + `darkMode.spec.ts`).
- Screenshot artifacts captured for Today, light and dark (390×844), confirming the ring/macro-bars/
  meal-card/bottom-tab-bar redesign holds up visually in both themes.
- Gate: `lint && tsc --noEmit && check:tokens && test && build && test:e2e` → all green. Bundle:
  159.38 KB gz initial (budget 300 KB).

## Phase 9 summary (9A–9F: PASS)
MacroDesi's UX/UI polish pass is complete: a real design-token system (Tailwind config sourced
directly from `src/theme/tokens.ts`, zero raw hex in components, enforced by `check:tokens`); a
persistent app shell with bottom-tab navigation, a FAB-driven add-food sheet, and animated screen
transitions; a redesigned summary card (animated ring, count-up numbers, Eaten/Remaining/Target,
tap-to-breakdown macro bars); meal cards with household-unit portion text, an overflow menu
(save/log template, copy from yesterday), swipe-to-delete-with-undo, and history-seeded "your
usual?" suggestion chips; app-wide motion polish (FLIP list animations, haptics, a skeleton loader)
and a full light/dark/system theme with a persisted toggle; and a closing accessibility pass
(44px touch targets everywhere, corrected heading structure, verified focus/contrast/aria-label
coverage). Final state: 235 unit tests, 51 E2E specs (including a dedicated touch-target audit and
a dark-mode a11y suite), zero axe violations across every scanned page in both themes, and a
159.38 KB gz initial bundle — all against the original 300 KB budget, unchanged since Phase 8,
with the entire 9A–9F polish pass adding zero new runtime dependencies beyond `framer-motion`
(added once, in 9B).

## Post-Phase-9 manual UI/UX audit (pre-Phase-10)
Before starting Phase 10, did a full manual pass through every screen/theme with real interaction
(not just automated assertions) — screenshotting onboarding, Today (empty + logged), the Add-Food
sheet, macro breakdown, meal overflow menu + its template sub-view, tap-to-edit, History/calendar,
day detail, Trends (weight chart + report), Settings (all 3 theme options + persistence),
Templates, Export, Recipe Builder, Scan (camera-unavailable fallback + real OFF barcode lookup),
and Quick Add, in both light and dark. Found two real bugs the automated suite had missed:

- **Dark-mode contrast bug**: the "Household unit"/"Grams" portion-mode toggle in `AddFoodPage.tsx`
  and `AddFoodSheetContent.tsx` builds its class list as a JS ternary
  (`` `...${mode === 'grams' ? 'bg-brand-700 text-white' : 'bg-slate-100'}` ``) — the 9E dark-mode
  sweep only pattern-matched literal `className="..."` strings, so this templated one slipped
  through untouched. In dark mode the inactive button had `bg-slate-100` with no explicit text
  color, which resolved to the *same* color as the button's own background (both `body`'s inherited
  `dark:text-slate-100`) — fully invisible text. Fixed by giving the inactive state an explicit
  `text-slate-900 dark:bg-slate-700 dark:text-slate-100` pairing in both files.
- **Navigation/discoverability bug**: Templates, Export, and the recipe builder (`/templates`,
  `/export`, `/recipes/new`) had **zero links anywhere in the app** — `grep` confirmed no
  `to="/templates"`, `to="/export"`, or `to="/recipes/new"` existed outside route definitions.
  9B's shell rewrite removed the old footer nav (which had linked to these) and its commit message
  claimed "recipes live in Add Food sheet + Settings" — but that migration was never actually done,
  and it went undetected for the rest of Phase 9 because every E2E spec that touches those routes
  reaches them via `page.goto()` directly, never a real click-through. Fixed: Settings gained a
  "More" section linking to Templates and Export; the Add Food sheet's "My Recipes" chip row (now
  always rendered, previously hidden entirely when `recipes.length === 0`, which is exactly the
  state a first-time user is in) gained a "+ New recipe" chip, wired through
  `AppShell`/`AddFoodSheetContent` the same way as the existing scan/custom-entry callbacks; the
  full-screen `AddFoodPage` (used for past-day logging) got the identical chip for consistency.
- New `e2e/navigationReachability.spec.ts` (3 specs) — deliberately click-through-only (no
  `page.goto()` to the destination) so this exact class of gap can't recur silently. 235 unit tests
  (unchanged — this was a UI-only pass), 54 E2E specs total (+3), all green. Bundle: 159.57 KB gz
  (budget 300 KB).

## 10.1 — Platform, Sync Engine
Built the offline-first cloud sync foundation: Postgres schema, Vercel serverless sync endpoints,
and the client-side outbox/pull engine, all wired into the six existing repos without touching any
UI. Google sign-in itself is Phase 10.2's job — this sub-phase only builds the machinery a signed-in
session will drive.

- **Server schema** (`drizzle/schema.ts`, Drizzle ORM + Postgres dialect): `users` plus one table per
  synced domain type (`profiles`, `targets`, `logEntries`, `weighIns`, `recipes`, `mealTemplates`,
  `scannedProducts`), mirroring `src/data/models.ts` field-for-field. Every synced table's primary
  key **is** the client-generated `clientId` UUID (`uuid('id').primaryKey()`) — no separate
  client-id/server-id mapping table, since it makes every push a plain idempotent upsert. Every
  table carries `userId` (FK to `users`, cascade delete) and `updatedAt`/`deletedAt` for LWW conflict
  resolution and sync-safe soft deletes. `npx drizzle-kit generate` produces clean migration SQL
  (`drizzle/migrations/0000_*.sql`, 8 tables) from the schema with no live database required —
  actually *applying* it against a real Neon instance is untestable until the database is
  provisioned (see `SETUP.md`).
- **Local schema** (`src/data/db.ts`): Dexie v3 adds an indexed `clientId` field to every syncable
  table plus two new tables, `syncOutbox` (queued pending mutations) and `syncMeta` (single-row:
  signed-in user + last-pull watermark). Existing v1/v2 rows aren't migrated in the upgrade
  transaction — `trackUpsert` backfills `clientId` lazily the first time a pre-Phase-10 row is
  touched again, so the Dexie migration itself stays a pure schema change with no data rewrite.
- **`/api/sync/push` and `/api/sync/pull`** (Vercel serverless functions, `@vercel/node`): push
  accepts a batch of outbox mutations and applies each with last-write-wins (skips a mutation if the
  server's `updatedAt` is already newer — the losing side just picks up the winner on its next pull);
  pull returns every row changed since a client-supplied watermark, soft-deletes included. Both
  route on a `getUserId()` cookie stub in `api/_auth.ts` — explicitly a placeholder 10.2 will swap for
  real Better Auth session verification without touching either handler's actual sync logic.
- **Client sync engine** (`src/lib/sync/syncEngine.ts`): `runSync()` pushes the outbox, pulls
  everything since the last watermark, merges pulled rows into Dexie via last-write-wins
  (`src/domain/sync/lww.ts`), and exposes a subscribable status (`signed-out` / `syncing` / `synced`
  / `offline` / `error`) rendered as a small dot in Settings (`SyncStatusDot.tsx`). `SyncTriggers`
  (mounted once in `App.tsx`, outside the route tree so it survives navigation) fires `runSync()` on
  app open, on the existing `dataVersion` "something changed" signal, and on the browser's `online`
  event — never blocking a log on the network, since the Dexie write always completes first.
  `trackUpsert`/`trackDelete` (`src/lib/sync/syncTracker.ts`) are the only new code path each of the
  six repos runs, right after their existing Dexie write; they no-op entirely while signed out, so
  guest/local-only usage is byte-for-byte unchanged. `scannedProducts` reuses its barcode as the
  `clientId` directly (rather than a random UUID) so two devices scanning the same product converge
  on one server row instead of duplicating it.
- **Tests**: 22 new pure-function unit tests for the outbox collapse/reconcile and LWW merge logic
  (`src/domain/sync/outbox.test.ts`, `src/domain/sync/lww.test.ts`), 8 for `trackUpsert`/`trackDelete`
  against a real `MacroDesiDB` + `LogRepo` (`syncTracker.test.ts`), 6 integration tests for
  `runSync()` against a hand-built in-memory mock server (`syncEngine.test.ts`) covering the gate's
  required "offline writes queue → reconnect → flush → pull merges" and "fresh cleared-IndexedDB
  session pulls all data" cases end-to-end through the real client code paths. New E2E spec
  (`e2e/sync.spec.ts`): logs a food entry while `context.setOffline(true)`, confirms it's queued
  locally and the (mocked) server hasn't seen it, goes back online and confirms the dot reaches
  "Synced" and the mock server received it, then clears IndexedDB, reloads, and confirms the entry
  reappears via pull — the exact scenario the 10.1 gate row requires. Since Google sign-in doesn't
  exist yet, the E2E test simulates an authenticated session by writing `syncMeta` directly via
  IndexedDB (the same technique other specs already use to seed fixture data); 10.2 will replace this
  with a real cookie-backed session.
- 271 unit tests total (+36), 55 E2E specs total (+1), all green. `lint && tsc --noEmit && test &&
  build && test:e2e` all pass. Bundle: 161.41 KB gz initial (budget 300 KB gz) — `drizzle-orm`,
  `@neondatabase/serverless`, and `better-auth` are only imported from `/api/*.ts`, so Vite's client
  build correctly excludes them; the entire client-side increase is `src/domain/sync/**` and
  `src/lib/sync/**`.
- New: `.env.example` gained the Phase 10 vars (`DATABASE_URL`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `VITE_APP_URL`) alongside the existing barcode/label-reader
  ones; `SETUP.md` documents Neon provisioning via the Vercel Marketplace and the Google Cloud
  Console OAuth steps 10.2 will need. `npm run db:generate`/`db:migrate` added; `vercel.json`'s
  `buildCommand` now runs migrations before `vite build` on every Vercel deploy, and its SPA-fallback
  rewrite excludes `/api/*` so those routes aren't swallowed by the `index.html` catch-all.
- Not yet done, deferred to later sub-phases as scoped: real Google OAuth (10.2), the time-aware meal
  prompt (10.3), grams-first logging (10.4), the barcode card polish (10.5), and native-feel/PWA
  manifest work + an actual `vercel --prod` deploy (10.6, blocked on the user having a real Vercel
  account).

## 10.2 — Google Sign-In, Local-to-Cloud Migration, Guest Mode
Built real Google sign-in on Better Auth, a first-launch sign-in screen, and the pull-vs-migrate-vs-
onboard decision the spec calls for — replacing 10.1's cookie stub with real session verification
without touching either sync route's own logic, exactly as planned.

- **Server**: replaced the bespoke 10.1 `users` table with Better Auth's own `user`/`session`/
  `account`/`verification` tables (`drizzle/schema.ts`) — `account.accountId` (Google's `sub` claim)
  replaces what the original draft called `googleSub`. Every synced table's `userId` FK changed from
  `uuid` to `text` to match Better Auth's own id type. `api/_authServer.ts` lazily builds a Google-only
  `betterAuth()` instance (Drizzle adapter, same lazy-construction pattern as `getDb()` so missing env
  vars don't break `tsc`/`build`/tests); `api/auth/[...all].ts` is the catch-all Vercel function
  (`toNodeHandler`); `api/_auth.ts`'s `getUserId()` is now async and calls
  `auth.api.getSession({headers})` for real — confirmed via Better Auth's own source
  (`node_modules/better-auth/dist/api/routes/session.mjs`) that a missing session cookie returns
  `null` before ever touching the database, so the 401-without-session path needs no live Postgres to
  test. `npx drizzle-kit generate` re-run against the new schema (11 tables now) — clean.
- **Cookie security**: httpOnly is always on; `secure` and `SameSite=Lax` come from Better Auth's own
  baseURL-driven default (`secure` turns on automatically once `VITE_APP_URL`/baseURL is `https://`,
  which it will be on every real Vercel deployment) — verified by reading `cookies/index.mjs` rather
  than adding redundant config, since Better Auth's own default already satisfies the spec.
- **Client**: `src/lib/auth/authClient.ts` (Better Auth React client, same-origin by default).
  `/welcome` (`SignInScreen.tsx`) is the true first-launch screen — logo, "Continue with Google", and
  "Skip for now" — shown only when this device has never made a choice (`hasMadeSignInChoice`: does a
  `syncMeta` row exist at all, regardless of `userId`). If a session already exists when `/welcome`
  mounts (cookie survived a cleared IndexedDB), it skips the buttons and resolves silently.
  `resolveAfterSignIn()` is the actual decision function: writes `syncMeta` with the real identity,
  asks the server (`syncEngine.serverHasProfile()`, a raw unmerged pull added for exactly this check)
  whether the account already has a profile — if yes, a normal `runSync()` pulls it down; if no *and*
  this device has pre-existing local (guest) data, `migrateLocalToCloud()` queues every existing local
  row through the same `trackUpsert` each repo already calls on a fresh write and pushes them in one
  `runSync()`; if neither, the caller sends the user to onboarding. `Dashboard`'s no-profile redirect
  now branches between `/welcome` (undecided) and `/onboarding` (guest, already decided) via the same
  `hasMadeSignInChoice` check. Settings gained `AccountSection` (sign in to back up / signed in as
  {email} + sign out — sign-out clears the server session but keeps every local row, per spec).
- **Dev-server fix (found via manual testing, not in the original spec)**: Vite's dev/preview servers
  have no route for `/api/*.ts` at all (only `vercel dev` or a real deployment do) and were silently
  falling back to serving `index.html` for those requests. Better Auth's client couldn't recover from
  getting HTML back where it expected JSON, which left `useSession()` stuck pending forever —
  hanging the sign-in screen on every `npm run dev`/`test:e2e` run, guest mode included. Fixed with a
  small `apiNotFoundInDev` Vite plugin (`vite.config.ts`) that answers `/api/*` with a real, fast 404
  in both dev and preview, so the client fails fast instead of hanging. Documented in `SETUP.md` that
  Google sign-in itself only works against a real deployment (or `vercel dev`) — guest mode needs
  none of it and now degrades correctly either way.
- **Tests**: `api/_auth.test.ts` (2) and `api/sync/security.test.ts` (2) — the spec's "non-auth routes
  return 401 without session" gate, run against the real handlers with only syntactically-valid env
  vars (no live DB touched, per the no-cookie-short-circuit above). `resolveAfterSignIn.test.ts` (4) —
  the spec's "new user → onboarding; returning user → pulled; existing-local-data user → migrated"
  integration cases, each against a mocked `authClient.getSession()` and the same in-memory mock
  server pattern from 10.1. `migrateLocalToCloud.test.ts` (2) — count assertions (every local row
  reaches the mock server, per table) and a checksum assertion (summed `kcal` across migrated
  `logEntries` matches between local and server, not just the row count). New E2E (`e2e/auth.spec.ts`,
  3 specs): `/welcome` shows both options on first launch; **guest mode is fully functional with every
  `/api/auth/*` route blocked** (the spec's explicit gate line) — skip, onboard, log a food entry, and
  Settings all work with zero dependency on the auth API being reachable; skipping once doesn't show
  `/welcome` again on reload. Every existing spec's `onboard()` helper (13 files) now clicks "Skip for
  now" first, since `/welcome` now intercepts every fresh session; added dedicated `/welcome` coverage
  to the existing a11y (light + dark), and touch-target audit suites rather than silently losing
  onboarding's own coverage when the first screen changed.
- 281 unit tests total (+10 over 10.1's 271: 2+2+4+2 above), 61 E2E specs total (+6 over 10.1's 55:
  3 in `auth.spec.ts` + 1 new a11y spec + 1 new dark-mode a11y spec + 1 new touch-target spec), all
  green.
  `lint && tsc --noEmit && check:tokens && test && build && test:e2e` all pass. Bundle: 173.20 KB gz
  initial (budget 300 KB gz; up from 161.41 KB gz in 10.1 — the Better Auth React client and
  `SignInScreen`/`AccountSection` are the only additions to the client bundle, `drizzle-orm`/
  `@neondatabase/serverless`/Better Auth's server-side pieces stay `/api`-only as before).
- Not yet verified (no live Neon database or real Google OAuth credentials exist yet — see `SETUP.md`
  for what the user still needs to provision): the migration actually running against Postgres, a
  real end-to-end Google redirect, and the cookie's `secure`/`SameSite` attributes as Chrome would
  actually send them over a real HTTPS connection (the logic driving them was read directly from
  Better Auth's source, not observed on the wire).

## 10.3 — Time-Aware Meal Prompt
Built the "open the app → it already knows" prompt: a pure boundary function, a bottom sheet reusing
Phase 9's suggestion engine, and a hook that decides when to show it based on both real time and the
tab's visibility history — plus a suite-wide fix for a real flakiness bug this surfaced.

- **`activeMealWindow(date: Date): Meal | null`** (`src/domain/mealPrompt/activeMealWindow.ts`) — pure
  function mapping local clock time to Breakfast 5:00–10:59 / Lunch 11:00–15:29 / Snacks 15:30–18:29 /
  Dinner 18:30–23:59 / null for 00:00–4:59, exactly per spec. 15 unit tests covering every window
  boundary (opens/closes on both sides) plus the dead-zone.
- **Dismissal** (`src/lib/mealPrompt/dismissal.ts`): "Not now" persists a per-day-per-meal flag in
  `localStorage` (`macrodesi:mealPromptDismissed:{date}:{meal}`) — the same lightweight approach
  `AdaptiveTargetPrompt` already uses for its own weekly dismissal, deliberately not a synced Dexie
  table since it's ephemeral, single-device UI state that resets every day regardless.
- **`useMealPrompt(todayEntries, enabled)`** (`src/app/hooks/useMealPrompt.ts`): evaluates on mount
  ("app open") and again on the `visibilitychange` event when the tab was hidden for more than 45
  minutes ("returning from background"), returning `{meal, dismiss, close}`. Shows a meal only when
  its window is active, has zero of today's entries, and hasn't been dismissed today; `close()` hides
  the sheet without persisting a dismissal (used when the user actually engages — Search, Scan, or a
  logged chip — versus "Not now").
- **`MealPromptSheet`** (`src/app/components/MealPromptSheet.tsx`): reuses the existing `BottomSheet`
  (swipe-to-dismiss, backdrop-click, Escape already built in from Phase 9) with up to 3
  `computeMealSuggestions()` chips, Search (opens the existing Add Food sheet pre-set to the prompted
  meal), Scan (same, with `startOnScan: true`), and "Not now". Mounted in `Dashboard.tsx` next to
  `AdaptiveTargetPrompt`, gated on `isToday` the same way.
- **Shared chip-tap logic extracted**: `MealSection`'s "your usual?" empty-state chip and the new
  prompt's suggestion chips both one-tap-log a `SuggestionChip` the same way — pulled the food-lookup
  + macro-compute + `addEntry` sequence out of `MealSection.tsx` into
  `src/lib/logging/logSuggestionChip.ts` so both call sites share one implementation instead of
  drifting.
- **Real flakiness bug found and fixed while testing this**: almost none of the existing 60 E2E specs'
  `onboard()` helpers pinned `page.clock` — they ran at whatever real wall-clock time the suite
  happened to execute at. That was harmless until this sub-phase gave the dashboard time-conditional
  UI: running the full suite at an hour that falls inside a real meal window made ~26 unrelated tests
  fail (the prompt's backdrop blocking their own clicks), and running it again at a *different* hour
  changed which ones failed — a real, pre-existing flakiness landmine this feature simply exposed
  rather than caused (a suite should never depend on the wall-clock time it happens to run at). Fixed
  at the root: every shared `onboard()` helper across all 13 e2e files now pins the clock to a
  dead-zone hour (`2026-08-18T02:00:00`, outside every meal window) as its first action, and the two
  spec files with no shared helper (`onboarding.spec.ts`, `auth.spec.ts`) got the same pin added
  per-test. The three files that already pinned a specific time for their own reasons
  (`adaptive.spec.ts`, `mealSections.spec.ts`, `templates-and-export.spec.ts`) had their now-redundant
  per-test pins removed in favor of the new helper-level default. `mealPrompt.spec.ts` itself is the
  deliberate exception — its tests each set their own specific meal-window time, since testing the
  prompt is the whole point.
- **Tests**: 15 for `activeMealWindow` (the spec's boundary-table requirement, well past its ≥10
  minimum). 6 integration tests for `useMealPrompt` (`useMealPrompt.test.tsx`, a `Probe` component +
  `vi.useFakeTimers()`/`vi.setSystemTime()`, matching the existing `useCountUp` hook-testing pattern)
  covering: prompts only when the active window is empty, an entry in a *different* meal doesn't
  suppress it, the 00:00–4:59 dead zone never prompts, "Not now" suppresses across a remount (real
  persistence, not just in-memory state), and `enabled=false` disables it entirely (used for past-day
  views). New E2E (`e2e/mealPrompt.spec.ts`, 5 specs, mocked clock via `page.clock.setFixedTime`):
  opening at 08:00 with an empty, history-backed breakfast shows the sheet with a working one-tap
  suggestion chip; "Not now" suppresses it and survives a reload; Search hands off to the Add Food
  sheet pre-set to the right meal; the 00:00–4:59 dead zone shows nothing; logging normally (FAB, not
  the prompt) also means no re-prompt on the next open.
- 302 unit tests total (+21: 15+6), 66 E2E specs total (+5), all green. `lint && tsc --noEmit &&
  check:tokens && test && build && test:e2e` all pass. Bundle: 173.94 KB gz initial (budget 300 KB
  gz; +0.74 KB gz over 10.2 for the prompt sheet + hook + domain/lib modules).

## 10.4 — Grams-First Logging
Replaced the household-unit-first add flow (a mode toggle between a portion `<select>`+qty and a
separate grams field) with a single grams field as the only way to set a quantity — household-unit
portions now only exist as gram-filling shortcut chips, never a stored unit, exactly per spec.

- **`PortionStep`** (`src/app/components/PortionStep.tsx`, new): the shared portion-entry step —
  previously `AddFoodSheetContent.tsx` and `AddFoodPage.tsx` each carried their own ~80-line copy of
  the mode-toggle/select/qty UI (a real duplication problem that made the toggle's Phase-9E dark-mode
  bug possible in the first place — see the pre-Phase-10 audit above). One grams `<input>`
  (`inputMode="decimal"`, `autoFocus`, selects its own text on focus so typing immediately replaces
  the default — no extra clear step), pre-filled from the food's typical portion
  (`portionsOf(selected)[0].grams`) or, in edit mode, the entry's existing `grams`. Quick-adjust chips:
  fixed `50 / 100 / 150 / 200 g` plus one chip per the food's own reference portions rendered as grams
  ("1 idli ≈ 40 g" — tapping it fills 40, not "1 idli"). A tabular-nums live preview
  (`computeMacrosForGrams`, unchanged from Phase 9) and a log button whose text *is* the result —
  `Add {grams} g · {kcal} kcal` — replacing the old static "Add to Breakfast" wording. Every save is
  `unit: 'grams'`, `portionLabel: undefined` — storage is grams-only, matching "household units become
  gram shortcuts, never the stored unit."
- **Where the meal name went**: since the button no longer says "Add to Breakfast", the add-food
  `BottomSheet`'s title is now dynamic (`Add to ${meal}`, set in `AppShell.tsx`) instead of the old
  static "Add food" — meal context is visible for the *whole* sheet lifecycle now (search step
  included), not just the final button, a small UX improvement alongside the spec change.
- **`AddFoodSheetContent.tsx` and `AddFoodPage.tsx`**: both shrank to search/select + `<PortionStep>`;
  all mode/portionIndex/qty/gramsValue state and the duplicated JSX are gone. `AddFoodPage`'s edit mode
  now simply passes `initialGrams={entry.grams}` — `grams` was already denormalized on every entry
  regardless of unit, so editing a *legacy* portion-unit entry pre-fills correctly with no branching.
- **`formatPortion()` needed no changes** — it already fell back to `"{grams} g"` whenever
  `unit !== 'portion'`, which is now always true for new entries; the caller-side `"{portion} · {kcal}
  kcal"` composition (`MealSection.tsx` already appended kcal after the portion string) already
  produces the spec's target "180 g · 292 kcal" display. `formatPortion()` still correctly renders
  legacy portion-unit rows in household units — verified by repurposing a Phase 9 E2E test that used
  to log via the live UI (impossible now, since new entries can't produce `unit: 'portion'`) to instead
  seed one directly, the same way other specs already seed fixture history.
- **Shared chip-tap logic**: `MealSection`'s "your usual?" empty-state chip already had its own
  food-lookup+macro-compute+`addEntry` sequence (Phase 9); extracted to
  `src/lib/logging/logSuggestionChip.ts` in 10.3 for the meal prompt to reuse — unrelated to this
  sub-phase but the same principle: `PortionStep` is the equivalent extraction for the portion-entry
  step itself.
- **Tests**: `PortionStep.test.tsx` (7) — defaults to the typical portion, live preview math (incl. an
  explicit rounding case: 33g of 12p/100g = 3.96 → displays "4p", not "3.96" or "3.9"), a fixed chip
  and the food's own portion-chip both fill the field correctly, the log button's dynamic text, and
  edit-mode pre-fill from `initialGrams`. `AddFoodSheetContent.test.tsx` (2, new) — the spec's
  "search→select→type grams→log updates totals exactly" integration case, driven against a real
  `LogRepo`/fake-indexeddb rather than a mocked `onSave`: search, select, type/chip-select grams, log,
  then read the row back from the database and assert every field. New E2E
  (`e2e/gramsFirstLogging.spec.ts`, 3 specs): grams field auto-focus + `inputmode="decimal"` +
  typical-portion default asserted directly; a 2-tap-plus-typing flow (select, type, log); a 3-tap
  chip-driven flow whose logged row shows grams, never a household-unit label. Updated every existing
  spec that logged food through the old flow (9 files, ~20 call sites) to the new
  `portion-grams-input`/`gram-chip-*`/`log-entry-button` test ids — `ScanProductPage.tsx` and
  `QuickAddPage.tsx`'s own "Add to X" buttons are separate components this phase didn't touch, so their
  specs (`barcode.spec.ts`, two of `summaryCard.spec.ts`'s three tests) needed no changes.
- 311 unit tests total (+9: 7+2), 69 E2E specs total (+3), all green. `lint && tsc --noEmit &&
  check:tokens && test && build && test:e2e` all pass. Bundle: 173.42 KB gz initial (budget 300 KB
  gz) — essentially flat versus 10.3 despite the new component, since it replaced roughly as much
  toggle/select/qty code as it added.

## 10.5 — Seamless Barcode Flow
Rebuilt the scan → product card → log path on the same grams-first foundation as 10.4, moved the
lookup off the critical path so the card can appear before the network responds, and along the way
found and fixed a real Phase-5 bug where the product's pack/quantity info was silently dropped by the
local cache.

- **Serving-size parser** (`src/domain/barcode/servingSizeParser.ts`, new): `parseServingSize(text)`
  handles "75 g" / "75g", "2 x 40g" (a multi-pack — count × unit weight), and "250 ml" (liquids, 1 ml
  ≈ 1 g), replacing `offParser.ts`'s old private regex that only matched a bare "N g" and silently
  mis-parsed "2 x 40g" as 40 instead of 80. 15 unit tests (the spec's exact three examples plus case
  variants and unparsable-input cases). Wired into `parseOFFResponse` for both `serving_size` and
  `quantity`; FDC's `servingSize` field is already numeric, so `fdcParser.ts` didn't need it.
- **Extended `ParsedProduct`/`ScannedProduct`**: `imageUrl`, `servingSizeText` (the source's raw text,
  kept for display), and per100g/perServing nutriment details (`fiber`, `sugar`, `saturatedFat`,
  `sodium`, all optional) — the spec's "store everything the barcode source returns." Two new OFF
  fixtures (`off-multipack-biscuits.json`, `off-cola-can.json`) exercise the multi-pack and ml parsing
  paths against realistically-shaped payloads, not just bare strings.
- **Real bug found and fixed**: `quantity` (the package's total grams, e.g. "2 x 40 g" → 80) was
  parsed correctly on first scan but `toScannedProduct()` never copied it onto the persisted
  `ScannedProduct` — it only existed on the transient `ParsedProduct` for the first, uncached response.
  Every *cached* rescan of a multi-pack product was silently missing its "1 pack"/"½ pack" chips ever
  since Phase 5, since `ScannedProduct` had no `quantity` field at all to put it in. Caught by the new
  E2E test (10.5's own gate requirement) rather than any pre-existing test, since nothing had
  previously exercised a product with real pack info end-to-end through the cache. Fixed by adding
  `quantity` to the model and threading it through `toScannedProduct()`; regression test added to
  `lookupProduct.test.ts` that explicitly asserts the field survives a second, cache-hit lookup, not
  just the first one.
- **Lookup moved into the product page**: previously `ScanPage` awaited the full cache→OFF→FDC chain
  before navigating, showing a blocking "Looking up product…" text. Now `ScanPage` navigates to
  `/scan/product/:barcode` immediately on decode (or manual submit) — the spec's "<300ms perceived" —
  and `ScanProductPage` owns the lookup itself, rendering a skeleton (`ProductCardSkeleton`, mirroring
  `DashboardSkeleton`'s `Pulse` pattern) while it's in flight and redirecting to `/scan/not-found/...`
  on an actual miss. `ScanNotFoundPage.tsx` is untouched per spec ("unchanged, but ending in the same
  product card UI") — its manual-save flow already funneled back into this same page.
- **`PortionStep` generalized** (was food/recipe-specific as of 10.4): now takes `per100g` +
  `referencePortions` directly instead of a `Selected`, plus an optional `quickGrams` list (default
  `[50,100,150,200]`, empty for the product card so its only chips are `getServingOptions()`'s own
  ½-pack/1-pack/serving options — matching the spec's literal 3-chip example instead of cluttering it
  with an unrelated fixed set). `AddFoodSheetContent`/`AddFoodPage` now own their "name + Change"
  header directly (moved out of `PortionStep`, since the product card's header needs brand/image/source
  too) and pass the same per100g/portions shape food selections already had.
- **Product card**: name, brand, image (when the source provided one), a per-100g summary line, and a
  small meal `<select>` — defaults to `activeMealWindow(new Date())` when the URL has no `?meal=`
  (also applied to `ScanPage`'s own fallback, for consistency), changeable before logging, matching
  "meal auto-selected by time, changeable via small selector."
- **Failure UX**: a feature-detected torch toggle (`track.getCapabilities().torch`, only surfaced on
  the native-`BarcodeDetector` path where the raw `MediaStreamTrack` is available) and a "Having
  trouble? Type the barcode." fallback — shown immediately when the camera is confirmed unavailable
  (the common case in this app's own test environment, and for desktop/permission-denied users), or
  after 5s of an active-but-non-decoding camera. Manual entry is no longer unconditionally visible —
  it's the recovery affordance for exactly these two failure modes, not the default UI.
- **Tests**: reliably faking a genuinely *decoding* camera (real video frames, native
  `BarcodeDetector` timing) inside headless Playwright proved too flaky to trust — a canvas-based fake
  `getUserMedia` stream got stuck before `video.play()` ever resolved. Moved torch-toggle and 5s-timer
  coverage to a Vitest component test (`src/app/ScanPage.test.tsx`, 3 tests) instead: a stubbed
  `BarcodeDetector` + `getUserMedia` forces the exact same component code path deterministically, with
  `vi.advanceTimersByTimeAsync` correctly interleaving the fake timer with the real
  getUserMedia/video.play() microtask chain. `ScanProductPage.test.tsx` (5, new) covers the spec's
  "scan→card prefilled with serving grams→one-tap add to time-correct meal" integration line directly:
  skeleton-then-card, prefill from detected serving size, one-tap add to the URL's meal, the
  `activeMealWindow` default when no meal is given (via mocking that function directly rather than the
  system clock, since its own boundary logic already has 15 dedicated tests), the meal selector
  actually controlling the logged entry, and a rescan hitting cache with zero network calls. New E2E
  (`e2e/barcodeScanFlow.spec.ts`, 1 spec, mocked OFF response): the full brand/image/per-100g/prefill/
  pack-chip/log journey against a multi-pack fixture — doubling as the regression check for the
  `quantity`-persistence bug. `e2e/barcode.spec.ts`'s existing two specs (manual entry, not-found →
  cache-hit rescan offline) already covered "rescan offline hits cache" from Phase 5; updated only for
  the new `log-entry-button` test id.
- 338 unit tests total (+27: 15+2+1+5+3+1), 70 E2E specs total (+1), all green. `lint && tsc --noEmit
  && check:tokens && test && build && test:e2e` all pass. Bundle: 173.60 KB gz initial (budget 300 KB
  gz).

## 10.6 — Native-Feel Polish & Vercel Deploy Prep
Closing sub-phase: makes the installed PWA look and behave like a real app rather than a bookmarked
website, then gets everything ready to actually deploy — the deploy itself needs the user's own
Vercel/Neon/Google accounts (see `SETUP.md`), so this is as far as an agent can take it.

- **Icons**: added `scripts/generate-icons.ts` (new `sharp` devDependency) rasterizing
  `icons/icon.svg` into a real PNG set — `icon-192`/`icon-512` (`any` purpose), full-bleed
  `icon-maskable-192`/`-512` (the existing SVG had its rounded-rect background baked in, which isn't
  safe for OS-applied masks — the maskable variant strips that so content stays inside the required
  80% safe zone), `apple-touch-icon.png` (180×180), and 4 `apple-touch-startup-image` splash screens
  covering current iPhone/iPad device classes (not Apple's full historical matrix — documented in
  `SETUP.md` for extending). Manifest gained `display_override: ["window-controls-overlay",
  "standalone"]` and the new icon entries; `index.html` gained `apple-mobile-web-app-capable`/
  `-status-bar-style`/`-title` metas, `apple-touch-icon`, and the splash `<link>`s with per-device
  media queries.
- **Install coach-mark** (`src/app/components/InstallCoachMark.tsx`, new): first-visit "Install
  MacroDesi" banner, mounted in `AppShell`. Android/Chrome: listens for `beforeinstallprompt`,
  `preventDefault()`s Chrome's own mini-infobar, shows a custom "Install" button that triggers the
  captured prompt. iOS Safari has no such event, so it gets illustrated "Share → Add to Home Screen"
  instructions instead (`isIOS()` via UA sniffing — there's no feature-detectable alternative). Never
  shows once already running standalone (`isStandalone()`: `matchMedia('(display-mode: standalone)')`
  or iOS's legacy `navigator.standalone`); dismissing persists in `localStorage`, same pattern as
  `AdaptiveTargetPrompt`'s weekly dismissal.
- **Native-feel CSS** (`src/index.css`): `overscroll-behavior-y: none` on `html` kills the page-level
  rubber-band bounce (individual scrollable containers — the bottom sheet already had
  `overscroll-contain` from Phase 9 — keep their own default, so nothing about in-sheet scrolling
  changed); `-webkit-tap-highlight-color: transparent` globally; `user-select: none` +
  `touch-action: manipulation` scoped to interactive chrome (`button`, `a`, `input`, `select`,
  `[role="button"]`, `[role="tab"]`, `nav`) rather than `*`, so body copy and macro numbers stay
  selectable while controls stop showing text-selection handles or double-tap-zooming. Safe-area
  insets were already handled for the tab bar and sheets (Phase 9) — verified, not re-done.
  Custom toasts-instead-of-`alert()`: already true since Phase 9's `Snackbar` component; confirmed via
  a repo-wide grep for `alert(`/`confirm(` (zero hits) rather than re-implementing something that
  already existed. Custom pull-to-refresh: spec explicitly allows "none," and `overscroll-behavior-y:
  none` already suppresses the browser's native one, so nothing further was built.
- **Small cleanup found along the way**: `BottomTabBar`'s FAB had its own hand-rolled time-of-day
  meal picker (`defaultMealForNow()`) with boundaries that quietly drifted from 10.3's canonical
  `activeMealWindow()` (e.g. lunch cutting off at 16:00 instead of 15:30) — consolidated onto
  `activeMealWindow()` so there's exactly one definition of "what meal is it right now" in the app.
- **View Transitions API — attempted, reverted**: wired `document.startViewTransition()` (with
  `flushSync` around the React Router `navigate()` call, the standard fix for the API's synchronous
  before/after DOM-snapshot timing) into the bottom tab bar's navigation. Found a real, reproducible
  bug: Framer Motion's `AnimatePresence mode="wait"` keeps the outgoing screen mounted through its own
  exit animation, and that overlapped badly with the View Transition's snapshot timing — the old and
  new screens' content stayed simultaneously in the DOM indefinitely (caught by
  `shell.spec.ts`'s existing tab-navigation test: both the Trends page and a stray Weight-form field
  were visible at once). `flushSync` didn't fix it. Rather than ship a navigation state that can get
  stuck, removed the integration entirely (`src/lib/viewTransition.ts` and its tests deleted) and kept
  Phase 9's Framer Motion transitions as the only screen-change animation — which is exactly the
  spec's own permitted "graceful fallback," just applied everywhere instead of only on unsupported
  browsers. A correct integration would need to either disable `AnimatePresence`'s exit animation for
  the browsers/routes using View Transitions, or use a routing layer with built-in support for both
  together — real scope, not attempted here.
- **Tests**: `InstallCoachMark.test.tsx` (6) — standalone hides it, no-event/non-iOS shows nothing,
  `beforeinstallprompt` shows the Android trigger (and calls `preventDefault`), clicking Install calls
  `prompt()`, iOS UA shows the Share instructions with no install button, dismissal persists across a
  remount. New E2E (`e2e/nativeFeel.spec.ts`, 6 specs): apple meta/icon tags present; a repeat-visit
  timing test (onboard → wait for `serviceWorker.ready` → reload → assert `today-view` appears in
  under 1.5s, the spec's own budget); no horizontal `scrollWidth` overflow on dashboard/history/
  settings; the three install-coach-mark platform behaviors (Android trigger, iOS instructions via a
  real UA-spoofed browser context, hidden in standalone mode via a mocked `matchMedia`). Extended
  `smoke.spec.ts`'s manifest test with `display: 'standalone'`, the `display_override` array, and a
  maskable-icon assertion. Full a11y suite (13 page/theme scans) and touch-target audit (9 pages) both
  re-run clean, unchanged from Phase 9F.
- 344 unit tests total (+6), 76 E2E specs total (+6), all green. `lint && tsc --noEmit && check:tokens
  && test && build && test:e2e` all pass. Bundle: 174.29 KB gz initial (budget 300 KB gz).
- **Not verified — needs the user's own accounts** (see `SETUP.md`): an actual `vercel build`/deploy,
  a live Neon database receiving a real migration, a real Google OAuth round trip, and the exact
  `secure`/`SameSite` cookie attributes Chrome sends over a genuine HTTPS connection. Also not
  verified: the maskable icons' actual crop on a real Android launcher, and the iOS splash screens /
  `apple-mobile-web-app-capable` standalone behavior on real iOS hardware — none of that is observable
  from this sandbox.

## Phase 10 summary (10.1–10.6: PASS)
Google sign-in, cloud sync, the time-aware meal prompt, grams-first logging, the seamless barcode
flow, and native-app-feel PWA polish — six sub-phases, each gated (`lint`, `tsc --noEmit`,
`check:tokens`, unit tests, `build`, `test:e2e`) before moving to the next, matching the discipline
used throughout Phases 0–9. Final state: 344 unit tests (up from 235 at the end of Phase 9 — +109
across all of Phase 10), 76 E2E specs (up from 54), a 174.29 KB gz initial bundle (unchanged 300 KB
budget, ~15 KB gz added across six sub-phases despite drizzle-orm/@neondatabase/serverless/better-auth
all staying server-only), zero axe violations across every scanned page in both themes, and a touch-
target audit that now also covers the new `/welcome` screen. Three real, previously-undetected bugs
were found and fixed along the way (not introduced by this phase, all pre-existing): a Phase 9E
dark-mode sweep miss on the AddFood portion toggle (fixed pre-Phase-10, in the audit that preceded
it), a Phase-5 barcode cache bug that silently dropped a scanned product's pack/quantity info on every
rescan (10.5), and a suite-wide E2E flakiness landmine where almost no spec pinned the system clock,
so results depended on the wall-clock time the suite happened to run at (10.3). One attempted
enhancement (View Transitions API for tab navigation, 10.6) was found to conflict with the existing
Framer Motion transition system and deliberately reverted rather than shipped half-working.

What's real vs. simulated: every sub-phase's own code is built for real and gated against
mocks/fixtures/an in-memory mock server — none of it has been exercised against a live Neon Postgres
database or real Google OAuth credentials, since provisioning those requires the user's own accounts
(`SETUP.md` documents exactly what to do and what each step unlocks). The app has not been deployed to
a Vercel URL. Phase 10's own exit criteria ("all six gates green cumulatively; app deployed to a
Vercel preview URL; PROGRESS.md updated with the URL and env-var checklist") is therefore met on the
code/gate side and open on the deploy side — the env-var checklist is in `SETUP.md` §3; the preview
URL line will be added here once the user deploys.
