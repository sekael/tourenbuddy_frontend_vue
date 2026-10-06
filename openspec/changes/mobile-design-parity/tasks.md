# Tasks

## 1. Motion primitives
- [x] 1.1 `useExitAnimation` + `fadeOut` (core composable) with `[data-exiting]` guard in `global.css`
- [x] 1.2 `FullScreenPage`: rise-in keyframe, fade-out exit; drop dead `.page-save-btn` CSS

## 2. Bottom sheet
- [x] 2.1 Reactive viewport (`useWindowSize`)
- [x] 2.2 `.content-body` + ResizeObserver refit, arithmetic measure, glide after first size
- [x] 2.3 Fit-content snaps = peek / fitted; peek is sticky
- [x] 2.4 Flick velocity
- [x] 2.5 `useSheetInset` → `--sheet-inset`; exit fade

## 3. Hosts and toasts
- [x] 3.1 `.sheet-host`, `.sheet-host--modal`, global `sheet` transition; migrate map, calendar, planned-calendar, 4 modal sheets
- [x] 3.2 `--float-bottom` / `--float-corner-bottom`; snackbar, offline, sync toasts/chips

## 4. Touch and polish
- [x] 4.1 Guard all `:hover` rules with `@media (hover: hover)` + `:active` twin
- [x] 4.2 Tap highlight off, `touch-action: manipulation` on controls
- [x] 4.3 Calendar bottom nav: tonal bar, `--font-size-xs`

## 5. Follow-ups from review
- [x] 5.0a Fit-content sheets: drag handle + detents (peek / 70% / full ≤ 90%) only when content overflows the opening height
- [x] 5.0b Guided tour: cancel staging on finish (run token + `TourEnded`), restore the starting overlay via `onDismissed`

- [x] 5.0c Tour list + tour detail: `resizable` sheets (peek / ≤ 40% / ≤ 70%), handle always shown
- [x] 5.0d Friend requests: stacked tab panels on mobile — constant height across tabs
- [x] 5.0e Tour detail redesign: header card, Route fact tiles with headline elevation, labelled Details/Partners sections
- [x] 5.0f Sheets drag from the header and rubber-band past the top snap
- [x] 5.0g Tour detail: activity tint throughout, completed/private stamps + card states, details card, partner avatar pills

## 6. Verification
- [x] 5.1 Tests: sheet fit grow/shrink/cap, sticky peek, drag ceiling, flick, rotation, stacked inset; exit composable
- [x] 5.2 `npm run test`, `npm run type-check`, `npx eslint .`, `vite build`
- [ ] 5.3 On-device pass (iOS Safari + PWA, Android Chrome + PWA): sheet ⇄ page fade-through (profile section, contact edit, tour edit, tour creation), modal sheets, calendar sheets, toasts over sheets, no sticky hover; guided tour end-to-end (map + calendar)
- [ ] 5.4 iOS PWA: check status-bar legibility over white page bars (follow-up if unreadable)
