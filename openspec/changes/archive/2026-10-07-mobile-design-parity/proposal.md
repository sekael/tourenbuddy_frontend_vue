# Proposal

## Why

`modern-design-preview` brought desktop to a calm, consistent, content-fitting design. Mobile (browser and PWA) — where most users are — was left behind in exactly the places desktop was polished:

- Opening a form or settings section swaps the bottom sheet for a full-screen page with a **hard cut** (`v-if` swap; the page is teleported, so no `<Transition>` sees it). Desktop glides the same step inside a dialog.
- Bottom sheets only size to their content on open: switching views, tabs or loading data leaves dead space or cuts content off. Desktop dialogs follow their content both ways.
- Sheet snap heights are `computed` over the untracked `window.innerHeight`, so they are frozen at first use (wrong after rotation / URL-bar changes); refits jump instead of gliding; drags ignore flick velocity.
- Modal sheets (contact actions, phone verification, link warning) and calendar sheets pop in and out with no motion.
- 37 `:hover` rules stick after a tap on iOS; the grey tap highlight flashes over the press feedback.
- Bottom-anchored toasts and status chips cover an open sheet's actions.
- The calendar's bottom nav still has a hairline border and a raw 10px label.

## What Changes

- **Fade-through between sheet and page.** `FullScreenPage` rises in on mount; a new `useExitAnimation` lets a surface that its owner unmounted fade out in place (re-inserted inert, animated with WAAPI, removed). Bottom sheets and modal sheet hosts use it too.
- **Bottom sheets fit content continuously** — a natural-height `.content-body` observed by a ResizeObserver, height measured arithmetically and glided (the `DialogWindow` pattern). Fit-content sheets snap between peek and the fitted height; a sheet the user parked at peek stays there.
- **Reactive snap heights** (`useWindowSize`) and **flick velocity** (> 0.5 px/ms moves one snap in the flick direction).
- **Shared sheet hosts** in `global.css`: `.sheet-host` (pass-through, `sheet` slide transition) and `.sheet-host--modal` (scrim fades, sheet rises) replace seven scoped `.sheet-container` copies; calendar sheets now slide.
- **Touch feedback:** every `:hover` rule is wrapped in `@media (hover: hover)` with an `:active` twin; `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` on controls.
- **Toasts clear open sheets:** sheets publish the tallest open sheet's height as `--sheet-inset`; toasts/chips anchor to `--float-bottom` / `--float-corner-bottom`.
- **Calendar bottom nav:** tonal bar instead of the hairline, `--font-size-xs` labels.
- Removed dead `.page-save-btn` CSS.

## Non-Goals

- iOS status-bar style. `black-translucent` (white glyphs) is kept because `pwa-support` requires edge-to-edge content under the notch; legibility over white page bars needs an on-device check (follow-up).
- Gesture-driven page dismissal (swipe-back), a sliding bottom-nav indicator.

## Impact

- Core: `bottom-sheet.vue`, `full-screen-page.vue`, `global.css`, new `use-exit-animation.ts`, `use-sheet-inset.ts`.
- Features: map page and calendar sheet hosts, four modal sheets, 37 hover rules across ~25 components, calendar nav.
- No API, data or guided-tour target changes (`data-tour` anchors untouched; the tour already waits for targets to settle).
