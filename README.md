# MacroDesi

Fat-loss focused calorie & macro tracker, mobile-first installable PWA, with an Indian/South
Indian food database, chicken & fish staples, and barcode scanning.

## Stack

React 18 + TypeScript + Vite + Tailwind CSS · `vite-plugin-pwa` · Dexie.js (IndexedDB) · Fuse.js ·
`BarcodeDetector` / ZXing · Recharts · Vitest + React Testing Library · Playwright.

## Develop

```bash
npm install
npm run dev
```

## Test gate

```bash
npm run lint && npx tsc --noEmit && npm run test -- --run --coverage && npm run build && npm run test:e2e && npm run check:bundle
```

Also available standalone: `npm run test:e2e -- e2e/a11y.spec.ts` (axe-core WCAG 2.1 A/AA scan of
every major screen) and `npm run check:bundle` (fails if the initial JS+CSS gzip size referenced
directly by `index.html` exceeds 300 KB — lazy-loaded routes like `/weight` and `/scan` don't
count against this, see `scripts/check-bundle.ts`).

## Build & preview

```bash
npm run build
npm run preview
```

## Lighthouse

```bash
npm run build && npm run preview   # in one terminal
npm run lighthouse                 # in another, once preview is up on :4173
```

Last audited run: Performance 100, Accessibility 100, Best Practices 100, SEO 100.

## Environment

Copy `.env.example` to `.env` and fill in optional API keys (USDA FDC, label-reader vision API).
The app works fully offline without either key.

## Deploy

Static output in `dist/` after `npm run build`. Build command for all three targets:
`npm run build`, output directory: `dist`. Client-side routing (React Router) needs an SPA
rewrite/fallback so deep links like `/history` don't 404 on a hard reload — configs for all three
targets are already checked in:

- **Vercel** — `vercel.json` (rewrites everything to `/index.html`). Connect the repo or run
  `vercel deploy --prod`; no other config needed.
- **Netlify** — `netlify.toml` (build command + publish dir + redirect) and `public/_redirects` as
  a fallback. Connect the repo, or `netlify deploy --prod`.
- **Cloudflare Pages** — reads `public/_redirects` (copied into `dist/_redirects` by the build)
  automatically; no `netlify.toml`/`vercel.json` needed. Build command `npm run build`, output
  directory `dist`.

The service worker (`vite-plugin-pwa`, `generateSW` mode) precaches the app shell and
`fooddb.json` at build time, so the app installs and works fully offline after the first visit —
no server-side config required beyond serving the static `dist/` output over HTTPS (required for
service workers + the `BarcodeDetector`/camera APIs).

See `PROGRESS.md` for phase-by-phase build status and hardening notes.
