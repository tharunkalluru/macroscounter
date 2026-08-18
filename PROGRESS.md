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
