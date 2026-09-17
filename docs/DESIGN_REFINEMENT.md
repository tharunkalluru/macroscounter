# Bitewise design refinement

Implemented locally on September 16, 2026. This pass builds on the existing lavender identity, recent authentication and landing-page work, and true OLED black theme.

## What I studied

Chris Raroque's [How I Make Apps FEEL 10x Better (5 Design Secrets)](https://www.youtube.com/watch?v=8mMH6Pq8qnE). I studied the transcript and inspected the actual demonstrations in the video, including the report UI around 1:15, voice interaction around 1:45, illustration variations around 3:25, and icon-weight comparison around 8:00. YouTube's transcript export was unavailable; the speech study used a [third-party transcript](https://www.usetranscribe.io/yt/8mMH6Pq8qnE/app-design-secrets), checked against the visible chapters and demonstrations. This is a transcript-plus-demo study, not a claim to have watched every frame.

I also applied the installed Emil Kowalski design engineering skill. The result adapts the principles to frequent food logging; it does not copy the demonstrated apps' artwork or branding.

| Video principle | Before | Implemented | Why it fits Bitewise |
| --- | --- | --- | --- |
| Purposeful interactions (0:32) | A slide on every route; inconsistent press feedback | Instant tab navigation, subtle pointer press feedback, restrained sheet entrance, reduced-motion support | Frequent logging stays quick; feedback identifies actual actions. |
| Contextual artwork (2:47) | Generic empty diary | Original bowl-and-leaves illustration with a useful Add food action | Explains the empty state without adding visual noise. |
| Haptics (4:52) | Existing browser vibration support | Retained capability-based behavior | Native iOS haptic examples cannot be assumed to work in a browser. |
| Consistent icons (6:06) | External font glyphs and random initial avatars | Inline SVG icon family, selected navigation variants, food-category glyphs | Consistent weight, recognizable states, and icons available without a font request. |
| Studying references (8:56) | Uneven hierarchy and spacing | Shared surfaces, clearer typography, cohesive navigation and forms | The whole logging flow feels related. |

## Implementation plan and outcome

1. **Study and audit:** map the video's examples to daily food-logging tasks, inspect the current code and browser experience. Complete.
2. **Refine hierarchy:** move logging actions above the summary on phones, compact the header and calorie layout, put the diary before secondary weekly review. Complete.
3. **Unify the interaction system:** apply consistent card radii and surfaces, food icons, search results, portion controls and empty states. Complete.
4. **Fix interaction details:** center desktop dialogs, retain mobile sheets, restore keyboard focus, reset scroll on route changes, preserve safe-area spacing and readable 44px date controls. Complete.
5. **Verify and refine:** exercise real browser interactions, inspect multiple viewport/theme combinations, run regression and accessibility checks. Complete.

Additional correctness fixes: past-day entries cannot trigger today's protein celebration while today's data is loading; in-app Reduce motion now reaches number updates, macro bars, diary rows, celebrations and sheets; the grams input has an explicit accessible label and shrinks safely on small screens.

## Verification

- **597 unit tests passed** across 87 files.
- **93 distinct browser tests passed:** 91 existing regression checks plus two new design journeys. The final 320px, keyboard and light/dark dashboard accessibility checks were repeated successfully after the last styling adjustment.
- Production build, TypeScript, lint, token validation and whitespace checks passed.
- Initial JavaScript and CSS: **243.59 KB gzip**, within the existing 300 KB budget.
- Automated coverage includes a simulated seven-day diary: backdating, copying yesterday, editing the original independently, reload persistence, saved meals and the weekly report.
- Manual browser review used an isolated local guest persona. I searched for idli, logged 120 g and verified 123 kcal; added Chai to yesterday at 80 kcal, edited it to 90 kcal, and verified today's 123 kcal remained unchanged. I also inspected hover behavior, empty search recovery, modal opening/closing, desktop layout, 320px and 390px phones, light and OLED dark themes. No browser errors were captured.
- The new keyboard journey verifies focus trapping and return, repeated reopenings without duplicate dialogs, reduced-motion CSS, and scroll reset. The new narrow-phone journey verifies larger numbers, contained nutrition content, 44px day targets and visibility of the selected historical day.

## Review files

The accompanying outputs include desktop and mobile screenshots in light and dark themes. Screenshots show local test data, not a user's production diary.

Live sign-in, cloud autoscaling, physical-device haptics and iOS keyboard behavior were not re-certified by this visual refinement. Existing authentication and synchronization implementations remain in place. Build output retains the existing large-chunk advisory; the measured initial bundle passes the app's budget.

All changes remain local. No commit or push was made for this design pass.
