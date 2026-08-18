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
npm run lint && npx tsc --noEmit && npm run test -- --run && npm run build && npm run test:e2e
```

## Build & preview

```bash
npm run build
npm run preview
```

## Environment

Copy `.env.example` to `.env` and fill in optional API keys (USDA FDC, label-reader vision API).
The app works fully offline without either key.

## Deploy

Static output in `dist/` after `npm run build` — deployable as-is to Vercel, Netlify, or
Cloudflare Pages (no server/build config beyond the default static build needed).

See `PROGRESS.md` for phase-by-phase build status.
