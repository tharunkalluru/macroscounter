# Bitewise

An offline-capable food diary with an Indian food catalog, barcode logging, recipes,
saved meals, calorie and macro tracking, weight trends, and optional Google sign-in,
cloud backup and AI-assisted logging.

## Run locally

Use Node 22.12 or newer. Install dependencies with `npm ci`, then run `npm run dev`.
Guest logging works without credentials. Plain Vite does **not** serve the API;
sign-in, cloud backup and AI require the server environment described in [SETUP.md](SETUP.md).

## Verify

```bash
npm run lint
npm run check:tokens
npm run test -- --run --coverage
npm run build
npm run check:bundle
npx playwright install chromium
npm run test:e2e
npm audit
```

The browser suite includes a seven-day logging journey, past-day entry/edit/copy,
offline logging, templates, keyboard focus, accessibility and phone touch targets.
Database tests apply every migration to an isolated PostgreSQL-compatible PGlite
engine and exercise the actual sync SQL. These are not live cloud load tests.
The GitHub workflow contains quality checks only; it does not deploy or migrate.

`npm run preview` serves the production frontend build. `npm run check:bundle`
checks the initial compressed JS/CSS against a 300 KB budget.

## Release preparation

See [the product plan](docs/PRODUCTION_PLAN.md) and [setup and release gates](SETUP.md).
Deployment builds deliberately do not run database migrations. Apply reviewed
migrations to an isolated staging database first and use a controlled production
migration window. A static-only deployment supports the guest experience; it
cannot provide the included Vercel API endpoints by itself.
