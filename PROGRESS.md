# MacroDesi — Build Progress

Tracks phase-by-phase execution against `dev-plan-ai-agent.md`.

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
