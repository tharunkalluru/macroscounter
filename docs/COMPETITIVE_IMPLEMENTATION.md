# Bitewise competitive upgrade

Implemented locally on September 16, 2026. No commit, push or deployment was made during this pass. The earlier local design work was retained.

## Product judgment

Bitewise had more feature breadth than its basic journey suggested. The largest gaps were setup friction, correction before saving, repeated entry and trustworthy coaching. MacroFactor, Cronometer, MyFitnessPal and Lose It! already establish expectations for these flows. Photo recognition and generic AI chat are not exclusive advantages. See [the source-linked benchmark](COMPETITIVE_BENCHMARK.md) and [the implementation plan](COMPETITIVE_PLAN.md).

The strongest differentiation hypothesis is the combination of familiar regional food, fast portion correction, reliable offline logging and low-effort repetition. Public research does not prove those capabilities are absent from every competitor. Real differentiation should be measured with users.

## Delivered

| Before | After | User impact |
| --- | --- | --- |
| Ten or eleven required setup screens | Three grouped steps, editable target preview and optional AI fact extraction; detailed setup remains available | Less work before the first meal. Guests can complete setup without an AI call. |
| Profile and target saved separately | One atomic setup transaction, duplicate-submit guard and retryable error | A failed save cannot leave half a setup. |
| AI values needed correction after logging | Edit food names, portion size and each nutrient; change meal/date; deselect items; inspect updated totals before saving | The user controls what enters the diary. Generated values remain clearly estimated. |
| Photo storage errors could imply the whole save failed | Committed food stays committed; retry saves only missing photos | Prevents duplicate food when an optional photo fails. |
| Separate repeat functions with inconsistent entry support | Home repeat card and shared atomic snapshot logging for catalog, custom, recipe, barcode and AI entries | Previously logged food is reusable with its actual portion and nutrition. Historical dates and destination meals remain explicit. |
| Generic coach screen and temporary chat | Weekly coverage, one next action, local-date context, three chat intents, bounded account-scoped tab history and recoverable questions | Useful repeat visits without automatic provider calls. Missing diary records are never presented as zero food intake. |
| Coaching assumed weight loss and a fixed interval | Cut/maintain/gain-aware review, selected rate, real time between weigh-ins, valid no-change reviews | Recommendations align with the user's goal. |
| Direct target acceptance and stale previews | Explicit review, missing-meal acknowledgement, consistent read snapshot and atomic verification of account/profile/target basis | Another tab cannot silently change the plan under the user's confirmation. |
| Some macro choices exceeded the calorie target | Optional fat allocation fits remaining energy; existing macro minimums can raise energy with visible explanation | Displayed calories and macros agree within integer rounding. These are consistency constraints, not outcome predictions. |
| Uneven layouts and interaction details | Balanced desktop home, restrained lavender hierarchy, true black dark mode, useful repeat defaults, 44px controls, preserved focus, correct landmarks and full-width drag feedback | More consistent daily use across desktop and narrow phones. |

The quick setup collects the facts needed for the existing target formula. It does **not** yet store cuisine, allergy, cooking-time or household preferences. AI chat can offer suggestions; this pass does **not** claim an integrated meal planner that can directly log a generated plan.

## Verification

- Production build, TypeScript, repository-wide ESLint, design-token and bundle checks pass. Initial JS/CSS is 283.27 KB gzip against a 300 KB budget.
- 669 unit, integration and component tests pass across 100 files. This includes real IndexedDB transaction rollback and concurrent/stale adaptive-apply checks.
- All 173 browser regression tests pass in the final stable build. Coverage includes onboarding, account screens, barcode, recipes, templates, dates, offline flows, drag, accessibility, mobile, dark mode and reduced motion.
- Hands-on browser work created a synthetic Ari profile, logged a custom breakfast for September 10, repeated it through September 16 using the UI, and inspected each destination. Every day retained 320 kcal and 18 g protein; weekly review showed 7/7 days with entries and explicitly described potentially partial diaries. This simulated a week's dates in one session; it was not a seven-day longitudinal user study.
- Inspected desktop and 320/390px layouts, hovered and clicked controls, changed appearance, reloaded pages and inspected browser errors. Fixed the observed 320px coach overflow; page width now matches the viewport while each day retains a 44px target.
- A drag regression exposed stale test coordinates during auto-scroll; the test now follows the actual target position. Separately corrected the real overlay geometry so an entry drags as a full row.

## Live AI and release gates

One synthetic request tested the setup extraction helper against the configured Anthropic provider. The key read from the project's local `.env.production.local` was rejected with **HTTP 401**. Its value was never printed or put in client code. The server-side integration, response handling and failure paths are tested, but authenticated live AI success and latency are not verified. No production database writes or deployment changes were made. There is no local `.vercel` project link available to establish whether the deployed service has newer credentials.

Before release: establish a valid provider credential and verify live AI end to end; exercise two real accounts on two devices, sign-in recovery, sync conflicts and data deletion; test production capacity, costs and alerts. Autoscaling is not proven by a frontend build or local concurrency tests. Existing server-side AI authentication and per-user shared usage budgets remain in place.

## Next highest-impact work

1. Food preference profiles and a concrete catalog-backed next-meal planner with portions, swaps and review-to-log.
2. Reliable recipe import and multi-day meal preparation, with preserved corrections and provenance.
3. Nutrition data quality and broader micronutrients, followed by health-device integration where supported.
4. Measure time to first log, repeat-meal time, AI correction rate, duplicate-save rate and seven-day return with real users.

None of those follow-ups are claimed as completed or unique to Bitewise.
