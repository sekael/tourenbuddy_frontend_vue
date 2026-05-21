## Context

The map page already centralizes overlay state in `src/features/map/presentation/pages/map-page.vue` via a single `activeOverlay` ref of type `OverlayName | null` and an `isPickingLocation` flag on the map store. The bottom-right speed dial (`MapActionOverlay` + `useMapOverlay`) currently bundles six entries: `feedback`, `base-map`, `profile`, `contacts`, `tours`, `add-tour`. The bottom of the screen is otherwise empty when no overlay is mounted.

Issue [#169](https://github.com/sekael/touringbuddy/issues/169) asks for the two tour actions to be promoted out of the speed dial into a persistent bottom-center bar (White Risk style) and for explicit single-active-interaction semantics across all FABs.

## Goals / Non-Goals

**Goals:**
- One always-mounted bottom-center bar with two FABs (`tours`, `add-tour`) using the same layout on mobile and desktop.
- Reuse the existing `activeOverlay` + `isPickingLocation` state — no new global store.
- Make "only one top-level interaction at a time" explicit at the component level: when an overlay is open, every other FAB / speed-dial trigger is disabled (or hidden, per the visibility rules in the proposal).
- Move the add-tour affordance into the tour list sheet as well (top-of-list button).

**Non-Goals:**
- Re-style or move the compass FAB / speed dial trigger (they stay bottom-right).
- Change the location-pick flow, tour creation dialog internals, or tour info sheet contents.
- Introduce a router-based representation of overlays.
- New i18n languages — only add keys to the existing `en.json` / `de-CH.json`.

## Decisions

### Visibility / enabled matrix lives in `map-page.vue`

The page is already the single source of truth for `activeOverlay` and forwards events to all overlay children. Adding a `<TourActionBar :visible="..." :tour-list-enabled="..." :add-tour-enabled="..." />` keeps the new component dumb — it only renders buttons and emits clicks. Computed flags on the page derive the matrix:

| State | Bar visible | tours btn | add-tour btn |
|-------|-------------|-----------|--------------|
| no overlay, not picking | yes | enabled | enabled (if authed) |
| `tours` overlay open | no | – | – |
| `tour` overlay open (info sheet) | no | – | – |
| `tour-creation` overlay open | no (already hidden via `isPickingLocation`-style gating) | – | – |
| `isPickingLocation` true | no | – | – |
| `profile` / `contacts` / `feedback` / `friend-requests` open | yes | disabled | disabled |

Alternative considered: derive everything inside `TourActionBar` via store/composable. Rejected — `activeOverlay` is page-local state, not a store, and threading it into a composable would duplicate the orchestration that `map-page.vue` already owns.

### Speed dial disable rule + dismiss-first interaction

`MapActionOverlay` currently hides itself entirely while `isPickingLocation` is true. For the new "any overlay → speed dial disabled" rule, pass an `:overlay-active` prop (derived from `activeOverlay !== null`) and use it to set `disabled` on `SpeedDialTrigger` instead of hiding it.

Per the user's interaction rule: while any modal overlay (bottom sheet on mobile, dialog or side drawer on desktop) is open, any tap *outside* that overlay — including on the disabled pill or the disabled speed-dial trigger — closes the overlay only; the second tap then performs the segment/trigger's own action. This dismiss-first behaviour is implemented page-side: each FAB's click handler reads `activeOverlay`, and when non-null calls `closeOverlay()` and returns early without invoking its primary action.

Alternatives considered:
- Hide the speed dial entirely while any overlay is open. Rejected — inconsistent with the chosen behaviour for the new bar and removes the affordance for the user to see where the menu lives.
- Let the disabled control fall through to the map-background click. Rejected — works on mobile (the sheet container is `pointer-events: none` outside the sheet) but not reliably on desktop where dialogs use a centered backdrop; explicit dismiss-first in the click handler is uniform across both.

### Enter / exit animation

Pill `v-if="visible"` wrapped in a `<Transition name="pill">` with 150ms `transform: translateY(8px); opacity: 0` ↔ identity, applied identically on mobile and desktop. Matches the existing `.panel` transition in `MapActionOverlay`. Avoids the snap-out the user would otherwise see while a bottom sheet slides up over ~300ms.

### Z-index layering

The pill mounts at `z-index: 20` — above `MapActionOverlay`'s `z-index: 10`, below `.sheet-container`'s `z-index: 50`. Pill has `pointer-events: auto` at all times so the dismiss-first handler fires reliably in both enabled and disabled states.

### Tour list "add tour" button

`tour-list-sheet.vue` already emits `select-tour` / `close`. Add a new `add-tour` emit; the page handler closes the list (`closeOverlay()`) and triggers `mapStore.setPickingLocation(true)` exactly as the speed-dial path did. This keeps the creation flow single-path.

### Styling

Single rounded pill (52px tall, 26px border-radius), two segments separated by a 1px `--color-outline-variant` divider — matches the White Risk reference. Left segment "My Tours" shows icon + text label; right segment is icon-only Add-tour with `aria-label` and tooltip carrying the existing add-tour wording. Surface tokens reused from `MapActionOverlay`/`SpeedDialTrigger` (`--color-fab-surface` semi-transparent, backdrop blur, `--shadow-md`). Positioned with `position: absolute; bottom: calc(var(--spacing-3xl) + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%);`. Rejected alternative: two separate circular FABs with labels — read as two floating controls rather than one persistent affordance.

### i18n

Add `map.actionBar.myTours` ("My Tours" / "Meine Touren") for the labelled segment — White Risk wording. Add `map.actionBar.addTourAriaLabel` for the icon-only Add-tour segment's accessible name. Reuse existing `map.overlay.addTourTooltip` / `signInToAddToursTooltip` for the Add-tour tooltip. Add `tours.list.addTourBtn` for the top-of-list button in `TourListSheet`. No new locales.

## Risks / Trade-offs

- **Reachability on small phones** → the bottom-center bar competes with the system gesture area on iOS. Mitigation: `env(safe-area-inset-bottom)` padding (same approach already used by `MapActionOverlay`).
- **Visual collision with the location-pick action bar** → already hidden during picks per the matrix, so no overlap.
- **Disabling speed dial vs hiding it** could surprise users who learned to dismiss overlays by tapping the speed dial. Mitigation: backdrop click + sheet close already dismiss overlays; the disabled trigger gives a consistent "this is locked" signal.
- **Tour list "add tour" duplication of the bar's add-tour** is intentional UX (matches the issue) but means two entry points must be tested.

## Migration Plan

Single-PR change, no data migration. Rollout = merge to `main` → release-please → Cloudflare Pages. Rollback by reverting the PR; no schema or stored-state implications.

## Open Questions

None at proposal time — all four open questions were resolved with the user before drafting (speed-dial dedupe, visible-but-disabled for non-tour overlays, hide-when-side-drawer-open with add button in list sheet, compass stays put).
