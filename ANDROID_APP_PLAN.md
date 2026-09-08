# Bitewise for Android — Complete Build Plan

A full-parity native Android client for Bitewise (repo: `macroscounter`, product name
"Bitewise", Dexie DB name `macrodesi`). This document is the complete specification —
an implementing agent should be able to build the app from this plus the existing
web source as the reference implementation.

**Reference implementation**: every screen, formula, and behavior described here already
exists in this repo as React/TypeScript. When this document says "port X", the source of
truth is the named file. Read it; don't re-derive it.

---

## 1. Product summary

Bitewise is a fat-loss-focused calorie and macro tracker aimed at Indian/South Indian
food. Offline-first: everything works with no network, and syncs to the cloud when
signed in. Core loop: log food (search / barcode / AI / quick-add / templates) → see
today's ring + macro bars → weigh in → weekly adaptive check-in adjusts your targets.

**Feature pillars**
1. Food logging — 307-item curated Indian food DB, barcode scan, AI (photo/voice/text), recipes, meal templates, quick-add
2. Targets — computed from a goal engine (BMR → TDEE → goal rate → macro split), adapted weekly from real data
3. History & trends — calendar, day detail, weight trend, expenditure, habits, weekly report, insights
4. Coach — weekly check-in wizard, program tracking, goal projection, and an AI chat grounded in the user's own data
5. Sync & auth — Google sign-in, guest mode, offline outbox with last-write-wins

---

## 2. Architecture decisions

| Concern | Decision | Why |
|---|---|---|
| Language / UI | **Kotlin + Jetpack Compose**, Material 3 | Matches the app's motion-heavy, custom-styled UI; Compose maps cleanly onto the existing declarative components |
| Min SDK | **26** (Android 8.0) | Health Connect needs 28+ but is optional; 26 covers the rest |
| Target SDK | Latest stable | Play Store requirement |
| Local DB | **Room** | Direct analogue of Dexie; same table/index shape (§5) |
| Networking | **Retrofit + OkHttp + kotlinx.serialization** | Cookie jar support is required for Better Auth sessions |
| Async | Coroutines + Flow | Repos expose `Flow` where the web uses `useEffect` reload + `dataVersion` |
| DI | Hilt | Standard; keeps repos/singletons testable |
| Navigation | Navigation-Compose | One-to-one with the existing route table (§7) |
| Charts | **Vico** (or Compose Canvas) | Replaces Recharts; the ring/sparkline/heatmap are hand-drawn Canvas anyway |
| Barcode | **ML Kit Barcode Scanning** + CameraX | Replaces `@zxing` + `BarcodeDetector` |
| Speech | Android `SpeechRecognizer` | Replaces Web Speech API (§10.3) |
| Images | Coil | Product images from Open Food Facts |

### 2.1 The single most important constraint

**The Android app is a client of the existing Vercel backend. It never holds a secret.**

- `ANTHROPIC_API_KEY` — stays server-side. The app calls `POST /api/ai/analyze` and
  `POST /api/ai/coach-chat`, exactly as the web app does.
- `DATABASE_URL` (Neon Postgres) — stays server-side. The app never connects to Postgres.
  It syncs through `POST /api/sync/push` and `GET /api/sync/pull`.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` — stay server-side. The app
  drives the existing Better Auth OAuth flow in a browser tab (§4).

This gives "same database, same AI credentials, same everything" for free: both clients
talk to the same deployment (`https://macroscounter.vercel.app`), so a row logged on
Android appears on the web after a sync, and vice versa.

**Base URL**: make it a build-config field (`BuildConfig.API_BASE_URL`) so debug builds can
point at a preview deployment.

---

## 3. Backend contract (existing endpoints — do not change their shapes)

| Endpoint | Method | Auth | Request | Response |
|---|---|---|---|---|
| `/api/auth/*` | — | — | Better Auth handler (Google social provider only) | session cookie |
| `/api/sync/push` | POST | session | `{ mutations: [{ table, clientId, operation: 'upsert'\|'delete', payload, updatedAt }] }` | `{ flushed: [{table, clientId, updatedAt}] }` |
| `/api/sync/pull` | GET | session | `?since=<epoch-ms>` | `{ tables: { [table]: Row[] }, pulledAt }` |
| `/api/ai/analyze` | POST | session | `{ description?, image?: {data: base64, mediaType} }` | `{ items: FoodItemResult[] }` |
| `/api/ai/coach-chat` | POST | session | `{ message, history?: {role,content}[] }` | `{ reply: string }` |

**Synced tables** (`SYNCED_TABLES` in `src/domain/sync/types.ts`): `profiles`, `targets`,
`logEntries`, `weighIns`, `recipes`, `mealTemplates`, `scannedProducts`.
The curated food DB is **not** synced — it's static reference data (§5.3).

**Error codes** returned by AI endpoints (mirror the web's messaging):
`not_signed_in` (401), `missing_key` (503), `invalid_input` (400), `no_profile` (400,
coach-chat only), `rate_limited` (429), `upstream_error` (502/500).

`FoodItemResult` shape: `{ name, gramsEstimate: number|null, kcal, proteinG, carbsG, fatG, fiberG, confidence: 'high'|'low' }`.

### 3.1 One server-side change required

Better Auth's OAuth flow redirects back to a URL that must be in `trustedOrigins`. Add the
Android app's deep-link scheme (e.g. `bitewise://auth-callback`) to the Better Auth config
in `api/_authServer.ts`, alongside the existing web origin. This is the **only** backend
change needed for the whole Android app — everything else already exists.

---

## 4. Authentication

Mirror the web's three states: **guest** (fully functional, local-only), **signed-in**
(syncs), and **undecided** (first launch → sign-in screen with a "skip" option).

**Flow**
1. `SignInScreen` offers "Continue with Google" and "Continue without an account".
2. Google → open `{BASE}/api/auth/sign-in/social?provider=google&callbackURL=bitewise://auth-callback`
   in a **Chrome Custom Tab** (not a WebView — Google blocks WebView OAuth).
3. Better Auth completes the flow and redirects to the deep link. The `Activity` catches it.
4. The session cookie set during that flow is captured by a **persistent OkHttp `CookieJar`**
   backed by `EncryptedSharedPreferences`. Every subsequent API call carries it.
5. "Skip" → set the guest flag (`hasMadeSignInChoice`, §6.4) and go to onboarding.

**Session state**: expose `Flow<Session?>` from an `AuthRepository` (calls
`GET /api/auth/get-session`), the analogue of the web's `useSession()`.

**After sign-in**, port `src/lib/sync/resolveAfterSignIn.ts` exactly — it handles the
subtle case where local data belongs to a *different* account (compares `linkedUserId`
in `syncMeta`), which previously caused a real cross-account data leak. Behavior:
- Local data + same user → keep, sync normally
- Local data + no prior user (genuine guest data) → `migrateLocalToCloud()`
- Local data + *different* prior user → wipe local before pulling

**Sign-out** (`signOutLocally`) deliberately **keeps** local rows so the same person can
sign back in without loss.

---

## 5. Data layer

### 5.1 Room schema (mirror `src/data/db.ts` exactly)

DB name: `macrodesi` (keep it — it matches the web and any future shared tooling).

```
profiles(id PK autoincrement, clientId INDEX, …)
targets(id PK autoincrement, effectiveDate INDEX, clientId INDEX, …)
foods(id TEXT PK, category INDEX, name INDEX, …)          -- not synced
recipes(id PK autoincrement, name INDEX, clientId INDEX, …)
logEntries(id PK autoincrement, date INDEX, meal INDEX, (date,meal) INDEX,
           foodId INDEX, recipeId INDEX, barcode INDEX, clientId INDEX, …)
weighIns(id PK autoincrement, date INDEX, clientId INDEX, …)
scannedProducts(barcode TEXT PK, clientId INDEX, …)
mealTemplates(id PK autoincrement, name INDEX, clientId INDEX, …)
syncOutbox(id PK autoincrement, (table,clientId) INDEX, …)
syncMeta(id PK autoincrement)                              -- single row
```

### 5.2 Entities (from `src/data/models.ts` — field-for-field)

Every synced entity carries `clientId: String` (UUID, generated client-side and used as the
Postgres PK), `updatedAt: Long`, `deletedAt: Long?`.

```kotlin
Profile(id, name, sex: "male"|"female", age, heightCm, weightKg,
        activityLevel: sedentary|light|moderate|active|very_active,
        goal: cut|maintain|gain,
        heightUnit: "cm"|"ft_in"?, weightUnit: "kg"|"lb"?, goalWeightKg?,
        dateOfBirth?, bodyFatPercent?, weightHistoryClass? (legacy),
        weighedMoreBefore?, recentWeightTrend?, dietStyle?, proteinPriority?,
        calorieFloorChoice?, goalRateLbPerWeek?)

Targets(id, effectiveDate, kcal, proteinG, carbsG, fatG, fiberG?,
        source: computed|manual|adaptive)

LogEntry(id, date, meal: breakfast|lunch|snacks|dinner,
         foodId?, recipeId?, customSnapshot?, barcode?,
         name, portionSummary, portionLabel?, qty, unit: portion|grams,
         grams, kcal, p, c, f, fiber?, loggedAt?)

WeighIn(id, date, weightKg)
Recipe(id, name, ingredients: [{foodId, grams}], servings, computedPer100g)
MealTemplate(id, name, entries: [{foodId, qty, unit}])
ScannedProduct(barcode, name, brand?, imageUrl?, per100g, perServing?,
               servingSize?, servingSizeText?, quantity?, source, firstScanned)
FoodRecord(id, name, aliases, category, per100g{kcal,p,c,f,fiber}, portions[{label,grams}],
           source, verified, favorite?)
```

`CustomSnapshot(name, kcal, p, c, f, fiber?)` — embedded JSON on `LogEntry`.

**Note on `fiber`**: nullable everywhere (`LogEntry.fiber`, `Targets.fiberG`,
`CustomSnapshot.fiber`) because it was added after launch and existing rows don't have it.
Handle the null case the way the web does (§8.4).

### 5.3 The curated food database

`public/fooddb.json` — 307 foods, built at compile time from
`scripts/data/curatedFoods.ts` by `scripts/build-fooddb.ts`. **Ship it as a bundled
asset** (`assets/fooddb.json`) and seed Room on first launch if `foods` is empty
(port `src/data/seed.ts`). Do not fetch it — it must work offline from install.

Rebuild the asset from the same script so the two clients never drift.

### 5.4 Sync engine (port `src/lib/sync/syncEngine.ts` + `syncTracker.ts` + `domain/sync/*`)

**Outbox pattern.** Every local write goes through a repo that also appends to
`syncOutbox` (`trackUpsert` / `trackDelete`). `runSync()`:
1. No-op for guests (`syncMeta.userId == null`) → status `signed-out`
2. Offline → status `offline`
3. Push outbox → `POST /api/sync/push`, then `reconcileAfterPush` drops flushed entries
4. Pull since watermark → `GET /api/sync/pull?since=`, merge with **last-write-wins**
   (`mergeRemoteRows` in `src/domain/sync/lww.ts`) — a remote row wins only if its
   `updatedAt` is newer; soft-deletes (`deletedAt`) propagate as local deletes
5. Update `syncMeta.lastSyncedAt`, status `synced`

**Statuses**: `signed-out | synced | syncing | offline | error` → surfaced by a
`SyncStatusDot` in the header (port `src/app/components/SyncStatusDot.tsx`).

**Triggers** (port `src/app/shell/SyncTriggers.tsx`): app foreground, regaining
connectivity, and after each mutation (debounced). Add **WorkManager** periodic sync
(~every 6h, network-constrained) — an Android capability the web doesn't have.

**Soft delete**: never hard-delete a synced row locally without writing a `delete`
outbox entry, or the deletion won't propagate.

---

## 6. Design system

Port `src/theme/tokens.ts` verbatim into a Compose theme. These are exact values —
do not re-pick them.

### 6.1 Color ramps (50→900)

```
brand   (= protein): f4f3fc e6e3f7 d1ccf0 b8b0e8 b1a8e6 9184d9 5340bf 352684 251b5d 18123d
carbs           : fcf9f3 f7f1e3 f0e6cc e8d8b0 e6d4a8 d9c184 bf9c40 846a26 5d4a1b 3d3112
fat             : f3f9fc e3f2f7 cce7f0 b0dae8 a8d6e6 84c3d9 409ebf 266c84 1b4c5d 12323d
fiber           : f3fcf5 e3f7e8 ccf0d5 b0e8be a8e6b7 84d999 40bf60 26843d 1b5d2b 123d1d
over (amber)    : fcf7f3 f7ece3 f0dbcc e8c8b0 e6c2a8 d9a884 bf7640 844e26 5d371b 3d2412
danger          : fef2f2 fee2e2 fecaca fca5a5 f87171 ef4444 dc2626 b91c1c 991b1b 7f1d1d
neutral         : f7f7fb edeef5 dee0ea c7cad9 a5aac0 636779 4e515f 393c46 272830 181a20 (+950 0f1015)
```

**Contract to preserve**: rung **400** ≥4.5:1 on dark surfaces; rung **700** ≥4.5:1 on
white; rung **500** is the graphical fill (rings/bars) only — never body text.
`semantic.success` = brand, `semantic.warn` = carbs, `over` is deliberately distinct from
carbs so an over-budget ring never matches the carbs bar.

### 6.2 Surfaces & themes

Three themes (port `src/domain/theme/resolveTheme.ts`): **Dark** (default), **Light**,
**Contrast**. Not "follow system" — that option was deliberately retired and migrated to
a concrete value.

```
light  : bg #f7f7fb  card #ffffff  raised #eef0f7
dark   : bg #161826  card #1c1e2b  raised #232532
contrast: bg #0a0b12  card #141225  brand400 #c2b8fa  brand600 #6c58e8
card radius 14dp · light shadow 0 0 0 1px rgb(15 23 42 / .08) · dark 0 0 0 1px rgb(233 233 237 / .16)
```

### 6.3 Type, spacing, motion

```
Font: Inter (bundle the variable font — don't rely on a CDN)
display 32sp/700/1.2 · title 20sp/600/1.3 · body 15sp/450/1.5
caption 12.5sp/450/1.4 · tag 10sp/600/1.0 (always UPPERCASE + widest tracking)
Spacing: 4dp base — 4, 8, 12, 16, 24, 32
Min touch target: 44dp (enforced app-wide; the web has an e2e audit for this)
Motion: screenTransition 200ms · ringSweep 450ms · countUp 300ms
        easing cubic-bezier(0.22, 1, 0.36, 1)
Numerals: tabular figures everywhere a number can change (rings, bars, totals)
```

**Reduced motion**: respect `Settings.Global.ANIMATOR_DURATION_SCALE == 0` *and* the
in-app `reduceMotion` preference — both must disable ring sweeps, count-ups, and page
transitions (port `usePrefersReducedMotion`).

### 6.4 Preferences (currently localStorage → use DataStore)

```
macrodesi-theme                          dark | light | contrast
macrodesi:reduceMotion                   bool
macrodesi:largerNumbers                  bool  (bumps ring numerals to 5xl/bold)
macrodesi:defaultLogView                 meals | timeline | month
macrodesi:foodSourcePreferences          { off: bool, fdc: bool }
macrodesi:adaptiveDismissedUntil         ISO date
macrodesi:mealPromptDismissed:<date>     per-day, per-window
macrodesi:proteinGoalCelebrated:<date>
macrodesi:goalWeightCelebrated:<kg>
macrodesi:streakMilestoneCelebrated:<startDate>
macrodesi:installCoachMarkDismissed      (drop on Android — see §10.5)
hasMadeSignInChoice                      guest-mode flag
```

---

## 7. Navigation & shell

### 7.1 Shell (port `AppShell.tsx`)

Two route groups, exactly as the web has them:

**A. Shell routes** — header + bottom tab bar + FAB, with a 200ms fade/slide page transition:
`/` `/log` `/history` `/history/{date}` `/trends` `/trends/expenditure` `/trends/habits`
`/trends/report` `/coach` `/settings` `/settings/food` `/settings/appearance` `/weight`
`/templates` `/export`

**B. Full-screen task flows** — no shell chrome (present as full-screen destinations):
`/welcome` `/onboarding` `/log/add` `/log/edit/{entryId}` `/log/quick-add` `/log/usuals`
`/log/ai` `/log/ai/result` `/log/library` `/weight/entry` `/coach/chat` `/coach/check-in`
`/coach/check-in/plan` `/recipes/new` `/scan` `/scan/product/{barcode}`
`/scan/not-found/{barcode}` `/templates/new`

> Note the web deliberately puts `/weight/entry` and `/coach/*` sub-flows **outside** the
> shell. Keep that distinction — it drives which screens show the tab bar.

### 7.2 Bottom bar (port `BottomTabBar.tsx`)

Five slots: **Today** (`/`) · **Log** (`/log`, active for `/log*` and `/history*`) ·
**[+ FAB]** · **Trends** (`/trends`, active for `/trends*` and `/weight*`) · **Coach** (`/coach`).

The FAB is a raised circular brand-600 button overlapping the bar's top edge, labeled
"Add". Tapping it opens the **Add Food bottom sheet** pre-targeted at the meal for the
current time window:

```
05:00–10:59 breakfast · 11:00–15:29 lunch · 15:30–18:29 snacks · 18:30–23:59 dinner
(00:00–04:59 → no active window; falls back to breakfast)
```

### 7.3 Header (port `Header.tsx`)

Wordmark, a streak chip ("N days" + flame), a sync-status dot, and the account avatar
(real Google photo when signed in, else initial) → `/settings`.

### 7.4 Global overlays mounted in the shell

- `GoalReachedTakeover` — full-screen celebration, checked **once per app open**, one-shot per goal value
- `InstallCoachMark` — **drop on Android** (§10.5)
- Add Food bottom sheet
- `Snackbar` with undo (swipe-delete restore)

---

## 8. Screen specifications

For each screen the web source is the exact reference. Below is what each must do.

### 8.1 Onboarding (`OnboardingFlow.tsx`) — 10–11 steps

Progress bar + back arrow + "n/total". Steps (goal-rate only appears when goal ≠ maintain):

1. **name** — text input
2. **basics** — sex (2-col choice grid) + date-of-birth wheel picker
3. **stats** — height (cm ↔ ft/in toggle) + weight (kg ↔ lb toggle)
4. **weight-history** — "ever weighed more?" (yes/no/not sure) + "last 3 months" (falling/rising/stable/not sure)
5. **body-fat** — optional 3×3 grid: 9/11/14/17/20/25/30/35/40 (labels "8-10%" … "38%+")
6. **activity** — 3 questions → scored to an `ActivityLevel`:
   - movement: sedentary(0) / moderately_active(1) / very_active(2) — "<5k / 5-9k / 10k+ steps"
   - training/wk: none(0) / light(1) / moderate(2) / frequent(3) — "0 / 1-2 / 3-5 / 6+"
   - lifting: none(0) / beginner(1) / intermediate(2) / advanced(3)
   - **score ≤1 sedentary, ≤3 light, ≤5 moderate, ≤7 active, else very_active**
7. **goal** — cut / maintain / gain
8. **goal-rate** *(skipped for maintain)* — live "Daily budget" + "Reach goal by" tiles, a
   target-weight slider (cut: 65–100% of current; gain: 100–135%, in lb), and a rate slider.
   Defaults: cut 1.0 lb/wk, gain 0.6 lb/wk; target weight defaults to −10% (cut) / +5% (gain)
9. **diet-style** — diet style (balanced / low_fat fat 0.5 g·kg / low_carb 1.1 / keto 1.5),
   protein priority (low 1.4 / moderate default / high 2.0 / extra 2.2 g·kg),
   calorie floor (standard / gentler +150 kcal / low override 800), plus a live macro preview
10. **coach-reveal** — chat-bubble explanation of BMR → TDEE → target, with an expandable
    "How did you work that out?"
11. **confirm** — big kcal number, a 7-day macro table with today highlighted, summary rows
    (expenditure, diet style, first check-in = next Monday, goal date), "Explain how this was
    built", and **"Start day 1"**

Validation: age 13–100, height 100–250 cm, weight 30–300 kg.
On finish: save `Profile` + insert the first `Targets` row (`source: 'computed'`).

### 8.2 Today / Dashboard (`Dashboard.tsx`)

- Optional "Day N of program" header
- `DateNav` (prev/next day; next disabled in the future) + **horizontal swipe** to change days
  (60px threshold) + "Return to today" pill when off-today
- **Calories ring** (`CaloriesRing.tsx`): 180dp, radius 70, stroke 12, sweeps over 450ms,
  center number counts up over 300ms. Under target → brand-600 stroke, center = remaining
  kcal, sub-label "kcal remaining". Over target → **over-600 (#bf7640)**, center = "+N",
  sub-label "over", ring full. Below it: Eaten / Remaining / Target trio.
- **Macro bars** ×4 — Protein, Carbs, Fat, Fiber. Each shows `consumed / target g`, fills
  proportionally with a floor of 2.5% scale so a nonzero value is never invisible; when over
  target the bar splits into within-budget + over segments and appends "· +N". Tapping opens
  a per-meal breakdown sheet.
- `AdaptiveTargetPrompt` (accept/dismiss a new suggested target), `CopyYesterdayPrompt`
  (one-tap clone of yesterday when today is empty), `MealPromptSheet` (nudge for the current
  meal window), `TodayEntryList`
- Celebrations: protein goal hit (confetti, once/day), streak milestones (3/7/14/30/50/75/100
  then every 50)

### 8.3 Log (`LogPage.tsx`) — three views

Segmented tabs **Meals | Timeline | Month** (default from `defaultLogView` preference), plus
a 7-day `DateStrip` for Meals/Timeline.

- **Meals** — four `MealSection` cards (Breakfast/Lunch/Snacks/Dinner), each with subtotal,
  an overflow menu (copy from yesterday, save as template), a "your usual" suggestion chip
  when that meal has a repeated history, and `+ Add`.
  **Drag & drop**: entries can be dragged by a handle between meal sections.
  - Mouse: 4px activation distance. Touch: **200ms long-press** + 8px tolerance (so a scroll
    swipe isn't hijacked). Haptic tick on pickup, handle highlights.
  - The drag preview must render the **whole row** (glyph + name + portion + kcal), not just an icon.
- **Timeline** — same day's entries grouped by the hour they were logged (`loggedAt`);
  entries predating that field bucket under their meal's typical hour
- **Month** — calendar heatmap; each day tinted by band: **green** ≤ target, **amber** ≤110%,
  **red** >110%, **none** if nothing logged or no target in effect

Every entry row: tap → detail sheet, swipe left → delete with undo snackbar.

### 8.4 Entry detail sheet (`EntryDetailSheet.tsx`)

Bottom sheet showing the entry. For quantity-based entries (grams > 0) it derives per-100g
values from the logged totals and offers live editing:
- **Grams / Servings toggle** appears when the food has known household portions
  (looked up via `foodId`). Servings mode: portion picker (if >1 portion) + count stepper
  (0.5 steps) + live "≈ N g"; saves `unit: 'portion'`, `qty`, `portionLabel`
- Grams mode: stepper + numeric field, live kcal preview
- Fixed custom entries (grams = 0) are read-only here and show a macro list (incl. Fiber
  when present) plus an "Edit" route to the quick-add form

### 8.5 Add food flows

- **Add Food sheet** (from FAB) — search box over the curated DB (Fuse.js fuzzy search →
  port to a Kotlin fuzzy matcher over the same index), favorites & recents chip rows, and
  entry points to: barcode scan, AI logging, custom/quick-add, recipe builder, library
- **`/log/add`** — full-screen version of the same (used for past days)
- **PortionStep** — grams-first: stepper (±10), numeric field, quick-gram chips (50/100/150/200),
  household-portion chips ("1 idli ≈ 40 g"), live `N kcal · Xp / Yc / Zf` preview, and a
  save button reading "Add 40 g · 41 kcal"
- **ServingPortionStep** — servings-first (used for scanned products with a known serving):
  count input, 1/2/3 chips, "1 serving = 40 g" caption, "Enter grams manually" escape hatch
- **`/log/quick-add`** — name + kcal + protein/carbs/fat/**fiber** inputs
- **`/log/library`** — previously logged items, one-tap re-log
- **`/log/usuals`** — repeated meal combos, one-tap log

### 8.6 Barcode (`ScanPage` → `ScanProductPage` → `ScanNotFoundPage`)

- Camera scanner (ML Kit), torch toggle when supported, manual-entry fallback after ~5s
  with no decode
- Lookup chain (port `lookupProduct.ts`): **local cache → Open Food Facts → USDA FDC**
  (only if a key is configured) → not-found. Each source can be disabled in Settings.
- Product card: image, brand, source badge, per-100g summary (incl. fiber when known),
  meal selector, and servings-mode entry when a serving size is parseable
  (`parseServingSize` handles "75 g", "250 ml", **and** "1 bar (40g)" style)
- **Fiber rule**: OFF usually declares per-serving kcal/protein/carbs/fat but *not* fiber.
  Always derive fiber from `per100g × grams` when the source lacks a per-serving figure —
  never drop it (this was a real bug; see `ServingPortionStep.tsx`)
- Not-found → manual product entry, cached for offline re-scans

### 8.7 AI logging (`AiLogPage` → `AiLogResultPage`)

**Sign-in required** (guests get a prompt). One screen with: a description textarea (500 char
cap), a **mic button** (§10.3), and a photo picker with preview/remove. Compress images
client-side before upload (~4MB cap).

`POST /api/ai/analyze` → result screen lists each detected item with a checkbox, macros
(`165 kcal · 31P 0C 4F 0Fb`), a "size estimated" flag for low-confidence items, a plate
total, and "Log all N". Items save as `customSnapshot` entries with `portionSummary`
"N g (AI estimate)".

### 8.8 History & Trends

- **`/history`** — month calendar, colored bands, future days non-interactive
- **`/history/{date}`** — that day's totals vs. the target *in effect on that date*
  (`findApplicableTarget`), entry list, add-food entry point
- **`/trends`** — hub: Weight, Expenditure, Habits, Weekly report cards + `InsightsSection`
  (weekend-vs-weekday, dominant meal, macro drift — each with its own threshold, else a
  "keep logging" placeholder)
- **`/weight`** — "Weigh in" button (the **only** way to add one), range tabs
  (1W/1M/3M/6M/1Y/All), a chart with raw points + a 7-day EMA line/area, and a swipe-to-delete
  weigh-in list. **No inline log form and no unit toggle here** — units live in Settings only.
- **`/weight/entry`** — full-screen numeric keypad, big hero numeral, unit label from the
  profile, 14-day sparkline trend, "Save weigh-in". On save, checks whether the goal was
  reached (one-shot per goal value) before navigating back.
- **`/trends/expenditure`** — computed expenditure history vs. the static estimate
- **`/trends/habits`** — logging streak + best streak + 30-day heatmap, consistency %,
  weigh-ins-this-week grid (n/7), and a protein-hit-rate bar chart. **Empty states matter**:
  no protein target → "Set a protein target in Settings"; target set but nothing logged this
  week → "Log a few meals this week to see this fill in"
- **`/trends/report`** — weekly report + a "vs last week" comparison once a prior week exists

### 8.9 Coach

- **`/coach`** (Strategy hub) — **"Ask your coach"** card (top, prominent), weekly check-in
  card (highlighted when due), current-program card (week number, diet style, kcal/protein,
  past programs count), and a goal-progress card (start → now → target, % bar, projected date)
- **`/coach/chat`** — sign-in gated. Chat thread using the coach bubble style (avatar +
  left-aligned assistant bubbles, right-aligned brand-filled user bubbles), an intro message,
  a "Thinking…" bubble while awaiting a reply, a text input with a **mic button**, and Send.
  Sends the last 10 turns as `history`. Conversation is **session-only** (not persisted).
- **`/coach/check-in`** — 4-step wizard (intro → your week → the math → new target) built on
  the same bubble components, ending in accept / keep-current
- **`/coach/check-in/plan`** — program update confirmation

### 8.10 Settings

- **`/settings`** — profile summary + editable fields (name, sex, age, height, weight,
  activity, goal, goal weight, **weight/height units**) with "Save & recalculate" (writes a new
  `Targets` row), account section (sign in/out, sync status), and links to sub-pages.
  Delete account & data is present but disabled.
- **`/settings/food`** — Open Food Facts / USDA FDC source toggles
- **`/settings/appearance`** — theme (Dark/Light/Contrast), reduce motion, larger numbers,
  default log view
- **`/templates`**, **`/templates/new`** — meal templates; applying one re-resolves each
  food's *current* per-100g values (never stale snapshots)
- **`/export`** — CSV export of entries + weigh-ins (use Android's share sheet / SAF)
- **`/recipes/new`** — recipe builder: ingredients × grams + servings → computed per-100g

---

## 9. Domain logic to port

All of these are pure functions with existing unit tests. Port them **with their tests**
(`src/domain/**/*.test.ts` → Kotlin equivalents); they encode real product decisions.

### 9.1 Goal engine (`domain/goals/goalEngine.ts`) — exact

```
BMR (Mifflin-St Jeor) = 10·kg + 6.25·cm − 5·age + (male ? +5 : −161)
TDEE = BMR × {sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9}
rateKcal/day = goalRateLbPerWeek × 3500 / 7
cut     : kcal = max(TDEE − (rate ?? 500), cutFloor)
gain    : kcal = TDEE + (rate ?? 300)
maintain: kcal = TDEE
cutFloor = max(BMR, floorOverride ?? (male ? 1500 : 1200)) + max(floorBuffer ?? 0, 0)
protein g = clamp(proteinGPerKg ?? 1.8, 1.6, 2.2) × kg
fat     g = max(fatGPerKg ?? 0.7, 0.7) × kg
carbs   g = max(0, (kcal − protein·4 − fat·9) / 4)
fiber   g = IOM Adequate Intake — male ≤50: 38, male 51+: 30, female ≤50: 25, female 51+: 21
```

> Fiber is deliberately **not** scaled by kcal — a deeper deficit shouldn't lower the fiber
> target, since fiber is what keeps a deficit satiating.

Rounding: `Math.round(Number(x.toFixed(6)))` to kill float noise before rounding half-up.

### 9.2 Adaptive weekly targets (`domain/adaptive/adaptiveTargets.ts`)

Over a trailing 7-day window, requires **7 logged days** and **≥2 weigh-ins** or returns null.

```
meanLoggedKcal = avg(daily kcal in window)
weeklyΔkg      = last weigh-in − first weigh-in (in window)
impliedTDEE    = meanLoggedKcal − (weeklyΔkg × 7700 / 7)
idealTarget    = impliedTDEE − 550        // 0.5 kg/week
adjustment     = round(clamp(idealTarget − currentTarget, −100, +100))
suggested      = max(round(current + adjustment), floorKcal)
```

Plus a natural-language `reason` string (`buildReason`) — reused verbatim to ground the
coach chat.

### 9.3 Portion math (`domain/logging/portionMath.ts`)

`computeMacrosForGrams(per100g, grams)` scales by `grams/100`, rounds to 1dp, and carries
fiber only when the source has it. `computeMacrosForServings(perServing, n)` scales the
source's own label figures. `sumMacros` always emits a defined `fiber` (missing → 0).

### 9.4 Others (port as-is)

| Module | Rule |
|---|---|
| `history/colorBand.ts` | green ≤ target · amber ≤110% · red >110% · none if no data/target |
| `ring/ringState.ts` | over-budget flips band, center becomes "+N" |
| `streaks/streak.ts` | streak allows today-in-progress; best streak = full history scan; milestones 3/7/14/30/50/75/100 then every 50 |
| `habits/habitsWeek.ts` | per-day weigh-in completion + protein hit-rate (0 when no target) |
| `history/ema.ts` | 7-day EMA seeded at the first point, α = 2/(n+1) |
| `goals/weightProjection.ts` | needs ≥3 points spanning ≥7 days; at-goal tolerance 0.3 kg; classifies at-goal / plateaued / wrong-direction / on-track |
| `programs/program.ts` | current program = most recent `computed` target; week = ⌊days/7⌋+1 |
| `logging/formatPortion.ts` | "3 idli", "1½ idli" from `qty × portionLabel`; never "3.13 × 100 g" |
| `search/searchService.ts` | fuzzy search over name + aliases |
| `barcode/servingSizeParser.ts` | parses "75 g", "250 ml", "1 bar (40g)", "2 × 40 g" |
| `reports/weeklyReport.ts` | week totals + `compareWeeklyReports` for vs-last-week |
| `insights/insights.ts` | weekend-vs-weekday, dominant meal, macro drift — each threshold-gated |
| `templates/applyTemplate.ts` | resolves against *current* food data |
| `export/csv.ts` | CSV row shapes |

---

## 10. Android-specific work

### 10.1 Health Connect (the reason to go native)

This is the one capability the PWA fundamentally cannot have, and it's worth building.
Samsung Health, Fitbit, Google Fit and others all write into Health Connect on Android.

- Read: `StepsRecord`, `ActiveCaloriesBurnedRecord`, `ExerciseSessionRecord`
- Request permissions at an obvious moment (Settings → "Connect activity data"), never at launch
- Store as a **new local-only table** first (`activityDays(date, steps, activeKcal, exerciseMinutes, source)`);
  only add server sync + a Postgres column once the shape is settled
- Surface on Today (a steps/active-calories row) and in Trends
- **Do not** auto-adjust calorie targets from it in v1 — the adaptive engine already infers
  expenditure from weight trend + intake, and double-counting activity is the classic way
  these apps get targets wrong. Show it; don't wire it into the math yet.

### 10.2 Notifications (also PWA-impossible)

- Meal-window reminders (respect the existing per-window dismissal keys)
- Weigh-in reminder (morning)
- Weekly check-in ready (Monday)
- All opt-in, all in Settings → Notifications

### 10.3 Speech input

Replace the Web Speech API with Android `SpeechRecognizer`. **Port the hard-won behavior**
from `useSpeechRecognition.ts`:
- Continuous listening with **auto-restart** when the engine ends the session on its own
  (silence timeout) — only a user-initiated stop should end it
- Deduplicate results: trust only the latest result; when new text *extends* what's shown,
  **replace** it rather than appending (this is what fixed "how / how can / how can i …"
  repeating). Append only when the new text is unrelated (a genuinely new utterance).
- Callers snapshot the field's text before listening and replace-from-that-base on each update

### 10.4 Widgets & shortcuts (nice-to-have, v2)

Glance widget showing kcal remaining + the macro bars; app shortcuts for "Log food" /
"Weigh in" / "Ask coach".

### 10.5 Things to drop

- `InstallCoachMark` (PWA install prompt) — meaningless in a Play Store app
- Service worker / offline shell — Room + bundled assets cover it
- `standalone.ts` PWA detection

---

## 11. Testing

Mirror the existing gate (`lint`, `tsc`, unit, build, e2e) with Android equivalents:

- **Unit (JVM)** — port every `src/domain/**/*.test.ts`. These are the highest-value tests:
  goal engine fixtures, portion math, streaks, EMA, projection, color bands, parsers.
  The web has ~504 tests; expect a comparable count.
- **Room migration tests** — schema parity with Dexie, and forward-migration safety
- **Sync tests** — outbox reconcile, LWW merge, soft-delete propagation, the cross-account
  switch case from `resolveAfterSignIn`
- **UI (Compose)** — the flows the web covers in Playwright: onboarding → target shown,
  log a food → ring/bars update, edit portion, swipe-delete + undo, drag between meals,
  weigh-in → chart, barcode → log, AI logging (mocked endpoint), coach chat (mocked),
  servings toggle, macro breakdown sheet
- **Accessibility** — touch targets ≥44dp, TalkBack labels, contrast in all three themes
  (the web has an axe-core suite covering every screen; match its coverage)

---

## 12. Build order

Ship in slices that are each independently useful.

**Phase 1 — foundation**
Project setup, theme/tokens, Room schema + entities, bundled food DB + seeding, repos,
navigation skeleton, shell (header/tab bar/FAB), guest mode.

**Phase 2 — core loop**
Onboarding (all steps + goal engine), Today (ring, macro bars, entry list), Add Food sheet,
search → PortionStep → log, entry detail sheet, swipe-delete + undo. *At this point the app
is usable offline as a tracker.*

**Phase 3 — auth + sync**
Custom Tabs OAuth + cookie jar, `AuthRepository`, sync engine (outbox/push/pull/LWW),
sync status dot, WorkManager periodic sync, `resolveAfterSignIn` account-switch handling.
**Requires the one server change in §3.1.**

**Phase 4 — logging breadth**
Barcode scan + product card + not-found flow, quick-add, recipes, meal templates, library,
usuals, copy-yesterday, meal prompts, Log tab's three views incl. drag & drop.

**Phase 5 — history & trends**
Calendar, day detail, weight page + weigh-in keypad, EMA chart, expenditure, habits,
weekly report, insights, CSV export.

**Phase 6 — coach + AI**
AI logging (photo/voice/text) + result screen, coach hub, weekly check-in wizard, adaptive
target prompt, goal projection + celebrations, coach chat with mic.

**Phase 7 — Android-native**
Health Connect, notifications, widgets, shortcuts, Play Store release prep.

---

## 13. Non-negotiables

1. **Never ship a secret in the APK.** No Anthropic key, no DB URL, no OAuth client secret.
2. **Offline-first.** Every read path must work with no network; writes queue in the outbox.
3. **Guest mode stays fully functional** — sign-in is only required for AI features and sync.
4. **Data compatibility is absolute.** Same `clientId` UUIDs, same field names, same date
   format (`YYYY-MM-DD`, local timezone — never UTC), same soft-delete semantics. A user must
   be able to use web and Android against one account without corruption.
5. **Don't re-derive the formulas.** They're tested and tuned; port them and their tests.
6. **Respect the contrast contract** in §6.1 — the ramps were built to specific WCAG ratios.
