# Setup — Cloud Sync (Phase 10)

MacroDesi is a local-first PWA: everything works offline with no account.
This doc covers provisioning the pieces needed for cloud sync and Google
sign-in, which only you (the project owner) can do since they require
creating real accounts and credentials.

Status: Phase 10.1 (sync engine + database schema) is built and tested
against a mocked server. Phase 10.2 (real Google sign-in) has not landed
yet — the steps below can be done now, but sign-in itself will still show a
placeholder until 10.2 ships.

## 1. Database — Neon via Vercel Marketplace

Vercel's own "Vercel Postgres" product was sunset; the free Postgres path
today is Neon through the Vercel Marketplace.

1. Push this repo to a GitHub repo, then import it in the [Vercel
   dashboard](https://vercel.com/new).
2. In the new Vercel project: **Storage → Marketplace Database Providers →
   Neon** → create on the free plan.
3. Vercel automatically adds a `DATABASE_URL` environment variable to the
   project (Production + Preview + Development) pointing at the new Neon
   database. You don't need to copy anything by hand — `vercel env pull
   .env.local` will fetch it into your local checkout if you want to run
   migrations from your machine.
4. Migrations run automatically as part of the Vercel build (see
   `vercel.json`'s `buildCommand`, which runs `npm run db:migrate` before
   `npm run build`). To run them by hand against a database you've
   connected locally:

   ```bash
   npm run db:generate   # regenerate drizzle/migrations/*.sql after schema.ts changes
   npm run db:migrate    # apply pending migrations to $DATABASE_URL
   ```

## 2. Google OAuth (needed for Phase 10.2)

Not required yet, but set it up now if you want it ready:

1. [Google Cloud Console](https://console.cloud.google.com/) → create a
   project (or reuse one) → **APIs & Services → OAuth consent screen** →
   configure as "External", add your own email as a test user while the
   app is unverified.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type "Web application".
3. Authorized JavaScript origins: your Vercel production domain (e.g.
   `https://macrodesi.vercel.app`) and `http://localhost:5173` (Vite dev
   server) / `http://localhost:4173` (preview server).
4. Authorized redirect URIs: `<origin>/api/auth/callback/google` for each
   origin above (Better Auth's default callback path).
5. Copy the generated **Client ID** and **Client secret** into
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## 3. Environment variables

Copy `.env.example` to `.env.local` for local dev, and set the same keys
in the Vercel project's **Settings → Environment Variables** for
Production/Preview:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Auto-added by the Neon Marketplace integration (step 1) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth client (step 2) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth client (step 2) |
| `AUTH_SECRET` | Any long random string — used to sign session cookies. Generate with `openssl rand -base64 32` |
| `VITE_APP_URL` | The canonical deployed URL, e.g. `https://macrodesi.vercel.app` — used for OAuth redirect construction |

## 4. Deploying

```bash
npm i -g vercel   # if you don't have the CLI
vercel link       # connect this checkout to the Vercel project
vercel            # deploy a preview
vercel --prod     # promote to production
```

The build runs `npm run db:migrate && npm run build` — migrations apply
automatically on every deploy, so `drizzle/migrations/*.sql` files must be
committed (they are not gitignored).
