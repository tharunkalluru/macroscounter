# Bitewise setup and launch runbook

Updated September 8, 2026. This change set is local. No push, deployment or live
migration has been performed. Local verification is not a production certification.

## Environments

Run Node 22.12+. Use `npm ci`, `npm run build` and `npm run preview` to review the
frontend. Guest data is stored in that browser's IndexedDB. API tests use isolated
fixtures; no real credentials are required for the local quality checks.

For the complete application, use a Vercel project with the included API functions
and a separate Neon PostgreSQL database for each release environment. Keep preview
data separate from production. Set the following in the server environment; local
API execution needs `vercel dev` and credentials. Plain Vite cannot perform OAuth.

| Setting | Purpose |
|---|---|
| DATABASE_URL | Database for this environment |
| GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Google OAuth web client |
| AUTH_SECRET | Strong random session secret, kept server-side |
| VITE_APP_URL | Canonical application origin, public by design |
| ANTHROPIC_API_KEY | Optional server-side AI provider credential |
| AI_DAILY_REQUEST_LIMIT | Combined per-account daily AI calls, default 100 |
| LABEL_READER_ENDPOINT / LABEL_READER_API_KEY | Optional HTTPS label-reader service and server secret |
| VITE_LABEL_READER_ENABLED | Public feature flag, false until provider verified |
| VITE_FDC_API_KEY | Optional browser-visible USDA fallback key; restrict its use and quota |

Do not place private credentials in VITE-prefixed variables. The label-reader
credential has moved to the server. Rotate any previously shipped browser secret.
Register each environment's exact `<origin>/api/auth/callback/google` URI in the
Google OAuth client. Validate consent-screen readiness for your intended users.

## Database rollout

1. Create an isolated staging database; confirm the destination without printing credentials.
2. Apply all pending checked-in migrations using `npm run db:migrate` with that
   environment's DATABASE_URL. Do not regenerate migrations during deployment.
3. Test upgrading a copy of existing data as well as an empty database. Migration
   0009 adds server change timestamps, tenant indexes, account-specific barcode
   keys and durable deletion records. Migration 0010 adds shared AI usage counts.
4. Verify old clients can reconnect and obtain a full incremental catch-up. Keep
   deletion records until a documented device-expiry/reset protocol exists.
5. Before production, take a recoverable backup and rehearse a restore. Schedule
   migration 0009 with an appropriate lock/statement timeout and maintenance plan
   for the scanned-products primary-key change. Review database size and lock impact.
6. Deploy only after staging acceptance and explicit release authorization.
   `vercel.json` builds only; preview builds cannot automatically migrate production.

Prefer additive forward fixes for rollback. Rolling back application code does not
roll back database state. Preserve backups and avoid deleting tombstones during rollback.

## Capacity and concurrency

The app keeps API handlers stateless and puts account isolation, conflict checks,
per-account write locking and AI quota enforcement in PostgreSQL. This supports
multiple function instances without relying on process memory for correctness.
Vercel Functions scale automatically within platform and plan limits; bursts can
still be throttled. [Vercel concurrency scaling](https://vercel.com/docs/functions/concurrency-scaling).

Configure database compute minimum/maximum and spending alerts in the selected
Neon plan, co-locate functions and database, and monitor cold starts and database
saturation. Verify actual autoscaling in that environment; no capacity number is
certified by local tests. The driver uses HTTP batched transactions.
[Neon serverless driver](https://neon.com/docs/serverless/serverless-driver).

Suggested staging acceptance workload (targets, not measured results): 100 distinct
accounts, ramp from 10 to 100 concurrently active clients over five minutes, hold
15 minutes, with 80% incremental reads and 20% ten-mutation writes; then repeat at
1,000 active clients only after the first run and budget review. Aim for sync p95
below two seconds, under 1% unexpected errors, zero cross-account exposure and
zero acknowledged mutation loss. Separately stress two devices editing one account,
same-barcode different accounts, 10,000-row initial sync, dropped responses, slow
transactions, deletes before inserts and a device reconnecting after a week.

The client uses an overlap window for incremental pulls. Long transactions beyond
that window and real multi-instance ordering still require staging fault injection;
PGlite is a single embedded database and does not establish multiworker guarantees.
Set appropriate database transaction timeouts and verify catch-up under failures.

## Required launch evidence

- Real Google round-trip for two unrelated accounts; new account, returning
  account, expired session, denied consent, sign-out and switch-account checks.
- Two separate browser/device stores: offline logging, edit during an in-flight
  push, reconnect, reload, delete/undo and restored-backup checks with real Neon.
- Real AI provider/model availability, quota exhaustion and provider outage;
  real label images only if enabled. Camera permission denial and scans on physical
  iOS Safari and Android Chrome; test speech input and installed PWA upgrades.
- Configure operational alerts for API failures, sync lag, rejected mutations,
  database saturation and AI spend. Do not record food photos, OAuth cookies,
  credentials or whole diary payloads in logs. Add request-level tracing before
  broad release; current local logs are not an operational monitoring service.
- Establish tested backup retention/restoration, support contact and incident owner.
  Define full account export/deletion and retention behavior before public launch;
  current CSV diary export is not a complete account data-management workflow.
- Confirm guest data/storage eviction wording, per-account preferences/favorites,
  duplicate first-device profile reconciliation, and real-device accessibility.
- Add edge abuse limits for unauthenticated auth endpoints and overall API bursts;
  the daily AI account quota is a cost control, not comprehensive abuse protection.
- Define cleanup retention for api_usage. Keep sync tombstones until an explicit
  reset strategy protects long-offline devices. Validate large-data query plans.

## Release sequence

After all above evidence is accepted: release to a small invited group, observe
backup failures and week-one logging retention, then expand gradually. Keep a
known-good deployment and restore procedure ready. Track time to first food,
repeat-log time, failed saves, sync recovery, and seven-day return rate using
privacy-conscious events. Do not treat days with entries as complete diet records.
