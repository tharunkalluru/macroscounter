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
