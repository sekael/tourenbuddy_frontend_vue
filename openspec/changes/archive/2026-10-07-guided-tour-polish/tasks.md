# Tasks

## 1. Engine
- [x] 1.1 Persistent driver per run; `moveTo` glide + two-phase popover reveal
- [x] 1.2 Popover fade-out before moves; anchor parking (`park(true|false)`)
- [x] 1.3 Skip staging for same-surface steps; `stage(surface, ctx, from)`
- [x] 1.4 Animated release with module-level `pendingDestroy` flush
- [x] 1.5 New pacing (`holdMs` / `glideMs` / `fadeMs`), reduced-motion support

## 2. Look
- [x] 2.1 Popover + hint-pill styling, rise-in / fade-out, exit dissolve
- [x] 2.2 Banner: glass, progress line, title cross-fade, filled next
- [x] 2.3 Welcome: badge + halo, staggered entrance, `welcome` transition, `icon` prop

## 3. Steps
- [x] 3.1 Map tour: new order, `menu` surface, offline-maps + calendar-sync steps, contacts merged
- [x] 3.2 `data-tour="calendar-sync"` on the profile row
- [x] 3.3 Map host staging with `from` shortest paths
- [x] 3.4 Calendar tour order + stage
- [x] 3.5 en + de-CH copy
- [x] 3.6 Fix: finishing a tour reopened via "Show app tour" returns to the profile sheet (design-system spec; the sheet closed itself before the origin was captured)
- [x] 3.7 Popover gutter clamp on both edges, measured on layout boxes (entrance transform skewed the rect)

## 4. Verify
- [x] 4.1 Composable tests: persistent glide, surface reuse + `from`, restart re-stages, delayed destroy flushed
- [x] 4.2 `npm run test`, `npm run type-check`, eslint
- [x] 4.3 Walk both tours end-to-end in headless Chromium, desktop 1440×900 + iPhone 13 emulation (forward, back across every surface, finish mid-staging, reopen, hand-off)
- [x] 4.4 Feel check on a real phone + installed PWA (motion pacing on a real GPU)
