# Design

## Context

On mobile, both tour form hosts pick their surface from the pick state:

- `tour-creation-dialog.vue` passes `:page="!isPicking"` to `AdaptiveOverlay`, which renders `FullScreenPage` or `BottomSheet` with `v-if` / `v-else-if`.
- `tour-info-sheet.vue` renders `<component :is="editAsPage ? FullScreenPage : … BottomSheet">` where `editAsPage` includes `!isPicking`.

In both cases the surface component changes when a pick starts. Vue unmounts the old component's subtree, so `TourForm`'s local refs (partners, tour type, dates, notes, …) are recreated from props. The goal, the picked point and the Swisstopo name/elevation survive only because the parent passes them back in as props. Desktop never swaps (`DialogWindow` / `SideDrawer` take `collapsed` and keep the slot mounted with `inert`), which is why desktop doesn't lose edits. A repro test with a stateful slot child confirmed the remount on mobile and none on desktop.

## Goals / Non-Goals

**Goals:** the form instance stays mounted for the whole pick in every tour form flow; the collapsed mobile look and the picker button offset stay the same.

**Non-Goals:** moving form state into a store; changing the desktop behaviour; changing the profile/contacts page flows (they never collapse).

## Decisions

**D1 — Collapse the page in place instead of swapping surfaces.** `FullScreenPage` gets a `collapsed` prop. When collapsed, the page shrinks to a bottom-anchored title bar styled like `.bottom-sheet--collapsed` (rounded top, shadow, title only), the content is hidden with `v-show` (stays mounted), and the close control and `page-action` slot are hidden. The two hosts stop flipping page mode off during a pick and pass `collapsed` instead.
Alternatives:
- *Lift the form state into the parent / a store* — touches every field of a ~1500-line form, and each host would need its own draft plumbing. Much bigger diff for the same result.
- *Make `AdaptiveOverlay` move one slot instance between surfaces (dynamic `Teleport` target)* — fragile with the surfaces' own teleports and exit animations, and wouldn't fix `tour-info-sheet`, which doesn't use `AdaptiveOverlay`.
- *`KeepAlive`* — caches a component by its own identity. Here the slot content is rendered by a different parent, so `KeepAlive` can't keep it.

D1 fixes it once, in the component both hosts already use, and the same pattern already exists on desktop (`collapsed` + slot kept mounted).

**D2 — `AdaptiveOverlay` forwards `collapsed` to `FullScreenPage`.** One prop added to that branch; no new API.

**D3 — Collapsed bar matches the collapsed bottom sheet.** Same placement and height (about 80px incl. safe area), so `LocationPicker`'s `actions-bottom: 80` offset in `map-page.vue` stays valid with no change. The collapsed page bar doesn't use `--sheet-inset`; the collapsed bottom sheet doesn't publish it either.

## Risks / Trade-offs

- [The page→bar change has no fade-through, unlike the old swap] → the transition is small (form disappears, bar stays); acceptable for a bugfix. A height/transform transition can be added later if it reads as a hard cut.
- [`page-in` keyframes rerun when the class changes] → the animation name stays the same and only the class is toggled, so it doesn't restart (same trick as `.dialog-card--collapsed`).
- [Focus stays inside the hidden form] → the collapsed content is `inert` + `aria-hidden`, matching `DialogWindow`/`SideDrawer`.
