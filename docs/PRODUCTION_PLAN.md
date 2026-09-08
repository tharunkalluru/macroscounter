# Bitewise product assessment and implementation plan

Date: 2026-09-08. Scope: local implementation and verification; no GitHub push, deployment or live database migration.

## Assessment

Bitewise is a capable mobile-first food tracker with offline logging, an Indian food catalog, barcode lookup, AI estimates, gram/serving entry, recipes, favorites/usuals, meal templates, copying yesterday, weight tracking, history, trends, adaptive targets, export and Google sign-in/cloud-sync code. Breadth is already strong. The largest opportunity is trust: every logging method must produce the same numbers, dates must survive navigation, and account data must remain isolated under simultaneous use.

Production readiness is currently blocked by tenant-unsafe cloud upserts, client clock based incremental sync, in-flight acknowledgement races, incomplete error recovery and absent evidence from real OAuth/database/load testing. The initial desktop interface is a narrow mobile column; important logging actions and sync state need clearer hierarchy. Eleven onboarding steps also delay the first useful action.

## Prioritized implementation

1. **P0 — User data and synchronization.** Atomic tenant-scoped conflict handling; account-scoped barcodes; strict payload validation and resource bounds; server change cursor and indexed pagination; safe acknowledgements of queued writes; account transition protection; honest failures and retry. Add migration files only, never apply to a live database during this task.
2. **P0 — Logging integrity.** Fresh cloud identities for copies; preserve all nutrient values when portions change; reusable complete meals that retain original portions; prevent repeated submissions. Verify totals and history after edit, delete and restoration.
3. **P1 — Clear, coherent daily experience.** Responsive daily overview; prominent logging shortcuts; accessible date selection; persist selected date through food entry and navigation; clear today/past-day empty states; weekly logging overview; consistent hover, focus, loading and error treatment.
4. **P1 — Verification from the user's perspective.** Create a separate browser persona; complete onboarding; log seven days; inspect day totals, history, portions, copying, templates, delete/undo, reload, mobile layout and offline behavior. Inspect console/network/server logs as well as relevant automated checks.
5. **Release preparation.** Record the final feature inventory, changes, test evidence and remaining launch gates. Document infrastructure, migrations, secrets, backups, monitoring, staged release and load testing needed to establish production readiness.

## Highest impact product bets

- Fast repeat logging: recent foods, accurate complete saved meals and copy-day flows reduce daily effort.
- Trustworthy history: explicit date context, editable portions and consistent nutrient totals across Today, Log and Trends.
- Reliable backup across devices: visible sync health, recoverable errors and strict account isolation.
- A useful weekly review: distinguish days with entries from completed days; avoid treating unlogged meals as zero consumption.
- Clear AI estimation review: users confirm names and portions before an estimate changes their diary.

Longer-term bets should follow retention evidence: shorter optional onboarding, better regional food coverage with provenance, full account export/deletion, and configurable reminders. Avoid promising health outcomes or unlimited autoscaling.

## Acceptance criteria

- Two users cannot overwrite one another, including scans of the same barcode.
- An edit made during a push remains queued until acknowledged at its actual version.
- Historical offline writes can be discovered by another device after reconnection.
- Copying an entry creates a distinct identity and preserves the original day.
- Serving quantities scale calories, protein, carbs, fat and fiber together.
- Logging from a past day retains that day and returns to the same diary context.
- Desktop and phone layouts support visible controls, keyboard focus and readable contrast.
- Errors are actionable and do not leave permanent loading states.
- Verification distinguishes mocked/local evidence from real cloud/concurrency evidence.

## Implementation status

The assessment above records the starting state. The local implementation and
verification pass is complete; see PRODUCT_REVIEW.md for changes and measured
results. SETUP.md lists the unresolved staging/public-launch gates. No live
infrastructure or GitHub changes were made.
