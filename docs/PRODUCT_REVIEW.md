# Bitewise: product review and implementation results

September 8, 2026 · Local changes only · No GitHub push, deployment or live migration

## Product judgment

Bitewise has the breadth of a serious food tracker. Its strongest differentiator is
practical regional-food logging combined with an offline diary. The main weakness
was trust across flows: copied meals, edited portions, historical dates and cloud
backup did not always behave consistently. Adding more top-level features before
fixing those foundations would have increased frustration.

The local product is substantially stronger after this implementation. It is ready
for a controlled staging review, not an unrestricted public launch. Actual OAuth,
cloud recovery, operating limits and physical-device behavior remain release gates.
No finite test run establishes that an application has zero inconsistencies.

## Current feature inventory

| Area | Features in the application | Assessment |
|---|---|---|
| Daily diary | Calories, protein, carbs, fat, fiber; meal groups; edit/delete/undo; timeline/calendar; past dates | Core habit loop; date integrity matters most |
| Food entry | Regional catalog/search, gram and household portions, recent/favorite foods, quick custom entry | Strong foundation for fast daily use |
| Repeat meals | Recipes, usual combinations, copy yesterday, reusable meal templates | High impact on repeated logging effort |
| Packaged foods | Camera/manual barcode lookup, cached products, manual label fallback | Useful; real cameras and external services need staging checks |
| AI | Text/photo/voice meal estimates, confirmation screen, coach | Optional convenience; estimates and provider availability must be explicit |
| Progress | Weight and trend charts, targets, program/goal settings, weekly report, adaptive coaching | Useful when missing days and changed targets are represented honestly |
| Access | Google sign-in/cloud-sync code, guest mode, offline PWA | Local and fixture tests pass; live sign-in and device convergence unverified |
| Preferences/data | Themes, contrast, reduced motion, units, CSV export | Full account deletion/export and preference isolation need further work |

## Highest-impact priorities and what was implemented

1. **Make a saved entry trustworthy.** Preserve fiber and portion quantities through
   edits, recipe calculations and copies. Give copied records fresh identities.
   Save complete meals atomically, including mixed custom and catalog entries.
2. **Make yesterday as easy as today.** Add a direct date picker and day strip;
   keep date context through search, quick add, scanning, AI and saved meals.
   Prevent stale entries from being actionable while a different day loads.
3. **Reduce repeat logging effort.** Complete saved-meal snapshots retain portions
   and nutrient totals, including custom foods that were previously dropped.
   Add visible shortcuts and a seven-day diary overview.
4. **Make backup honest and account-safe.** Tenant-scoped conditional database
   writes, account-specific barcode keys, validated/bounded batches, paginated
   pulls, durable deletion markers and exact-version acknowledgements. Protect
   pending writes and account transitions, surface retryable failures and distinguish
   local saving from cloud backup.
5. **Make the interface coherent.** Responsive desktop sidebar and dashboard,
   phone navigation, clearer headings/empty states, improved dialog focus and
   positioning, reduced-motion support, readable nutrient summaries and consistent
   kg/lb presentation in onboarding and trends. Dragging uses the actual drop pointer.
6. **Prepare safer operations.** Shared daily AI quotas, server-only label-reader
   credentials, provider timeouts, security headers and updated dependencies.
   Database migrations are reviewed separately from builds. A local GitHub quality
   workflow is prepared; it has not run remotely.

## UI review

The earlier desktop experience used a narrow phone-style column. The new dashboard
uses the available width to separate nutrition from logging actions, while retaining
one-column phone navigation. Day context and backup status are visible. The ring,
nutrient bars and weekly overview use consistent meaning: entries are not represented
as complete dietary records, and days without targets are not marked over budget.

Direct browser inspection found and corrected a dialog whose drag behavior could
freeze its entrance animation, undersized weekly day controls, stale entries during
date changes, and an onboarding unit mismatch. Reviewed dark desktop and phone
layouts and light phone layout. The fixed phone navigation stays accessible while
scrolling; full-page screenshots show it at the captured viewport position.

Remaining product opportunities, in order: shorten the eleven-step onboarding;
finish account data controls; improve catalog provenance/coverage; then trial
opt-in reminders and richer repeat-meal editing. Measure time to first food,
repeat-log time, failed saves, successful backup recovery and seven-day retention
before adding social features, challenges or more AI surface area.

## Verification evidence

| Check | Result |
|---|---|
| Unit/repository/API/database tests | 550 passed across 82 files |
| Domain line coverage | 98.73%; this is domain coverage, not whole-app coverage |
| Full Chromium browser suite | 153 passed in the final run |
| Accessibility and touch targets | Included in browser suite: major screens, dark mode and 390×844 phone controls |
| Production build / TypeScript / lint | Passed |
| Design-token and whitespace checks | Passed |
| Initial compressed JS + CSS | 232.12 KB, within 300 KB budget |
| Dependency audit | Zero known vulnerabilities reported in the installed dependency tree |
| Actual migrations/SQL | All migrations applied to isolated PGlite; tenant isolation, deletion ordering, old writes, pagination and AI quota checks passed |
| Live cloud / capacity / physical devices | Not verified; no credentials or infrastructure provisioned in this task |

The seven-day browser journey enters six previous days through visible date and
logging controls, copies yesterday into today, reloads, edits the original without
changing the copy, saves a custom-food meal template, applies it to a past day and
checks the weekly total. Separate tests cover decimals, invalid dates, offline
logging, delete/undo, barcode fallbacks, keyboard focus and reload persistence.
This simulates a week of use; it is not a seven-day elapsed-time field study.

In addition to scripted journeys, a separate browser persona completed onboarding,
searched and logged 120 g of idli, edited it to 80 g (123 to 82 kcal), reloaded,
logged a 450 kcal custom meal on the previous day, inspected diary context, hovered
logging controls, and changed appearance. Browser console/error inspection returned
no entries during that manual review. Local preview logs showed no runtime failures.
API/provider flows require a server environment and were not exercised live there.

## Launch decision and remaining work

**Proceed to isolated staging, subject to its configuration; do not call this
public-production ready yet.** The implementation does not provision autoscaling
or certify a concurrent-user capacity. Vercel provides function autoscaling within
its limits; database sizing, budgets and end-to-end load behavior must be verified
in the chosen environment. [Vercel scaling documentation](https://vercel.com/docs/functions/concurrency-scaling).

Before public launch, complete real two-account/two-device OAuth and sync tests,
backup restore drills, staged migrations, provider/camera checks, load/failure
injection, monitoring and abuse controls. Finish full account export/deletion,
retention and per-account preferences. Validate long-running transaction catch-up
and large-history pagination. The detailed staging workload, migration sequence,
configuration and operational gates are in SETUP.md.
