## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/247-map-page-scroll-lock`

## 2. Relocate the lock rule

- [x] 2.1 `src/app/theme/global.css` — add the lock rule under the new class name: `html.scroll-locked, html.scroll-locked body { overflow: hidden; overscroll-behavior: none }` and `html.scroll-locked body { position: fixed; inset: 0 }`. Do **NOT** carry over `touch-action: none` from `onboarding-tour.css:15` (design D3) — the tour never exercised it (its subtree is `pointer-events: none` and sets its own `touch-action: none` at `map-page.vue:942`), and it is not what stops document scroll. Keep a comment stating why `body { position: fixed }` is load-bearing (iOS ignores `overflow: hidden` for momentum / rubber-band / address-bar scroll) — that reason is the whole fix
- [x] 2.2 `src/features/onboarding/presentation/onboarding-tour.css` — delete both `tour-scroll-locked` blocks. The file keeps only the driver.js popover overrides. Do NOT delete the file or its import at `use-onboarding-tour.ts:8`
- [x] 2.3 `src/features/calendar/presentation/components/seasons-gantt.vue:224` — rename the selector to `html.scroll-locked .gantt-track`

## 3. `useScrollLock` composable — **your gap**

- [x] 3.1 New `src/core/composables/use-scroll-lock.ts` — implement per design D2, marked with `// TODO(me):`. Signature `useScrollLock(active?: MaybeRefOrGetter<boolean>)`. No argument = locked for the caller's whole mounted lifetime; a ref/getter = follows its value. Module-level refcount, class `scroll-locked` on `document.documentElement` present while count `> 0`. Must release exactly once on unmount, including when the reactive form is already unlocked at that moment — a double decrement locks the app forever, on every route, and not visibly on this one. No public release API. Add a `ponytail:` comment recording that the counter is NOT load-bearing today (`runtime-core.cjs.js:5376-5379` unmounts before it mounts, and `App.vue:25` has no `<Transition>`) — it guards the day someone adds one

## 4. Wire the two pages

- [x] 4.1 `src/features/map/presentation/pages/map-page.vue` — call `useScrollLock()` with no argument. Delete the `tourLockActive` computed + watch (`:337-343`) and the `document.documentElement.classList.remove(...)` line in `onUnmounted` (`:353`); the route is now locked before any tour can start (design D1). Keep the rest of `onUnmounted` (`onboardingTour.stop()`) untouched
- [x] 4.2 `src/features/calendar/presentation/pages/calendar-page.vue` — replace the watch at `:220-224` and the removal line at `:241` with `useScrollLock(tourLockActive)`. Behaviour must be unchanged: locked exactly while the tour or its welcome is showing, including the synchronous auto-start case the current `immediate: true` covers

## 5. Contain modal scroll (design D4)

- [x] 5.1 Add `overscroll-behavior: contain` to the scroll region in each of: `src/core/components/bottom-sheet.vue:436` (`.content`), `src/core/components/dialog-window.vue:159`, `src/core/components/side-drawer.vue:154`. One declaration each, next to the existing `overflow-y: auto`. `contain`, never `none` — `none` would also kill the region's own end-of-scroll rubber-band. Do **NOT** touch `full-screen-page.vue:129`: a page has nothing behind it to chain into
- [x] 5.2 **(design D7, found in 6.2 device testing)** Add explicit `overflow-x: hidden` next to `overflow-y: auto` in the same three regions (`bottom-sheet.vue`, `dialog-window.vue`, `side-drawer.vue`) — an unset `overflow-x` computes to `auto` alongside a set `overflow-y` (CSS Overflow spec), which is why the tour detail sheet could scroll horizontally at all. `src/features/tours/presentation/components/tour-info-sheet.vue` — add `.detail-row > *:not(.detail-icon) { min-width: 0; overflow-wrap: break-word }` so the actual overflow source (icon+value rows: coordinates, place names, partner chips) shrinks and wraps under the new limit instead of being clipped

## 6. Verification

- [x] 6.1 `grep -rn "tour-scroll-locked" src` MUST return nothing. A missed site is a silent onboarding-tour regression, not a build error
- [x] 6.2 **Real iOS device (Safari + Brave), map route, no tour running.** This is the only proof the fix works — nothing below it is covered by CI (design D6). (a) drag on the sheet edge, the action bar, and the picker button row — the page must not bounce and the address bar must not collapse; (b) enter the picker, aim the crosshair at a landmark, hard-scroll every non-canvas surface, confirm — the saved point must be the landmark; (c) open the tours sheet with enough rows to overflow — content must still scroll by touch under the lock. **Confirmed: scroll-lock works.** Surfaced the pre-existing horizontal-scroll bug fixed in 5.2 (design D7) — re-verify the tour detail sheet no longer scrolls sideways
- [x] 6.3 **Map gestures with an overlay open** (stated requirement, both platforms): with a side drawer open on desktop, wheel-zoom over the still-visible map must zoom; on mobile with a bottom sheet open, pinch/drag/rotate on the visible map must work. Expected to pass untouched — MapLibre owns `touch-action` on its canvas container and drives the camera from raw pointer/wheel events — so a failure here means the shared rule picked up a declaration it should not have
- [x] 6.4 Run the onboarding tour on **both** the map and calendar routes and step through it — spotlights must stay glued to their targets. This is the regression the rename risks
- [x] 6.5 Desktop browser: map route must not scroll; every other route must scroll normally after navigating away from the map

## 7. Test

- [x] 7.1 New `test/core/composables/use-scroll-lock.test.ts` — **one** case, the refcount arithmetic: two holders where one unmounts leaves the class in place, and the second unmount removes it. No component mount, no fixtures, no happy-path test. Everything else this change does is invisible in happy-dom and is covered by section 6 instead (design D6)

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` (zero warnings) and `npm run type-check`
- [x] 8.2 `npm run test` — all green
- [x] 8.3 Prompt the user to commit:

      ```
      fix(map): never scroll the document on the map route (#247)

      The map page was pinned but the document behind it was not: #app's
      min-height: 100lvh leaves a scrollable overflow whenever browser chrome
      is shown, so any gesture outside the map canvas scrolled or rubber-banded
      the document. The canvas moved with it while MapLibre's camera did not,
      so the location picker unprojected a canvas that had slid out from under
      the crosshair and saved the wrong point.

      Apply the onboarding tour's existing html+body pin for the whole map
      route, extracted into a refcounted useScrollLock composable and moved
      from onboarding-tour.css to global.css as html.scroll-locked. Contain
      overscroll in the core sheet/dialog/drawer scroll regions so sheet
      scroll can never chain outward.
      ```

- [x] 8.4 Prompt the user to push and open a PR against `main`, linking issue #247. No Worker deploy, no `supabase db push` — this change touches neither
