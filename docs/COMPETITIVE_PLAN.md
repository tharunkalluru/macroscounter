# Competitive product implementation — September 2026

The primary-source benchmark is recorded in `COMPETITIVE_BENCHMARK.md`. AI recognition, chat, repeat meals and adaptive coaching are established competitor capabilities. This pass improves the complete path from setup to review to repeated use; it does not establish market-wide uniqueness.

## Prioritized delivery

| Priority | Before | After | Why / acceptance |
| --- | --- | --- | --- |
| P0 | Adaptive review assumes weight loss and a fixed interval | Goal-aware cut, maintain and gain review using actual dates; explicit diary completeness confirmation | Coaching must reflect the user's actual goal. Missing records cannot be treated as zero intake. |
| P1 | Ten or eleven setup screens | Three grouped steps, optional AI draft extraction, deterministic target preview and explicit confirmation | Reach the first useful meal sooner. Manual setup works for guests and without AI. Profile and targets save atomically. |
| P1 | AI portion corrections happen after logging | Editable ingredients, quantities and nutrition before one final save; natural-language refinement | Match competitor review quality. Preserve meal/date and clearly label estimates. Prevent retries from duplicating an already saved meal when a photo fails. |
| P1 | Repeated meals are scattered and exclude some entry types | Contextual repeat cards with portion snapshots, destination selection and atomic writes | Reuse AI, barcode, custom and recipe meals just like catalog meals. Preserve backdated context. |
| P1 | Empty generic chat and narrow coaching page | Specific starter intents, recoverable questions, bounded account-scoped history, useful local weekly review | Make guidance actionable; avoid unnecessary AI calls and misleading claims about incomplete diaries. |
| P2 | Home shows isolated tools | A clear daily brief and familiar meals next to nutrition and diary | Help users choose the next action without auto-logging a plan or assuming recorded food is their full intake. |

## Design direction

Use Bitewise's lavender accent, restrained surfaces, a strong heading hierarchy, consistent controls and genuine OLED black. Navigation and repeated actions remain immediate. Apply Emil Kowalski's guidance to feedback, focus, interruption and reduced motion. Desktop uses space purposefully; mobile retains 44px touch controls and readable forms at 320px.

## Verification and launch boundaries

Check adult setup validation, explicit AI-draft confirmation, unit conversion, atomic save rollback, editable AI nutrition, failed and repeated saves, historical dates, sparse weeks, goal direction and review intervals. Exercise real browser journeys in light/dark and mobile/desktop, inspect browser errors and persisted records, then run targeted and full regression checks.

This pass uses the existing server-side AI provider, authentication and shared usage budget. Keys stay off the client. Live provider/authentication, two-account/two-device recovery, production capacity, observability, nutrition data operations and load testing remain separate launch gates until directly verified.

## Differentiation hypotheses and next work

The promising combination is familiar regional foods, fast correction, consistent offline logging and useful repeat meals. Validate it with time to first log, time to repeat a meal, correction frequency, duplicate-save rate and seven-day return. No success metric is claimed without measurement. Preferences-aware meal planning, recipe import, micronutrients and health integrations need complete follow-up designs; they are not represented as shipped here.
