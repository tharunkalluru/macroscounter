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
