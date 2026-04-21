## Context

The map page composes three independent pieces of UI:

- `LocationPicker` (full-screen overlay with crosshair + Cancel/Confirm FABs) gated by `mapStore.isPickingLocation`.
- `TourInfoSheet` in edit mode, rendered inside `SideDrawer` on desktop and `BottomSheet` on mobile, containing `TourForm` with form inputs and "Pick" / "Change" buttons for goal, start point, and end point.
- `TourCreationDialog` for the add flow (also coordinates with the picker).

Today the picker signals via `mapStore.setPickingLocation(true)` and expects map-page / sheet to orchestrate the rest. The mobile sheet already has a visual-only partial collapse (`tour-info-sheet.vue:157`), but the form inside stays enabled and the submit path is not guarded. The desktop drawer has no collapsed mode at all. Existing spec `tours > Tour goal editable via location picker` claims the sheet "SHALL be hidden" while picking, but this is not actually enforced for start/end picks and not correctly enforced on desktop.

Result: users can edit + save the tour while the picker is open, leaving the picker orphaned with stale context so Cancel/Confirm no-op (issue #66).

## Goals / Non-Goals

**Goals:**

- While a location pick is in progress, the only interactive controls SHALL be the picker's navigate/zoom/cancel/confirm controls.
- The tour edit surface (side drawer on desktop, bottom sheet on mobile) SHALL remain mounted but visually collapsed to a title-only header so the user keeps context ("Edit: <tour title>") without being able to submit.
- `TourForm` SHALL expose a single `disabled` switch that disables inputs and all non-picker buttons in one place.
- Submit paths in `TourInfoSheet` and `TourCreationDialog` SHALL refuse to run while `isPickingLocation` is true (defense in depth for keyboard-triggered submits).
- Same coordination SHALL apply to goal, start point, and end point pickers.

**Non-Goals:**

- Redesigning the picker overlay itself.
- Converting the picker into a first-class `activeOverlay` on map-page (larger refactor). We keep the current flag-based coordination but tighten it.
- Changing how picked coordinates flow back to the form (`editPickedPoint` / draft props continue to work).
- Changing PWA / offline behavior, auth, or any data-layer logic.

## Decisions

### 1. Drive collapse from `isPickingLocation`, not from the caller

Rationale: the sheet/drawer already read the map store. Having `TourInfoSheet` compute `collapsed = isPickingLocation && mode.value === 'edit'` keeps the coordination contract in one place and works uniformly on desktop + mobile (mobile already uses `isPickingLocation` for a partial collapse — we generalize it).

Alternative considered: emit events from `LocationPicker` and have map-page imperatively toggle the sheet. Rejected — `map-page.vue` already carries too much overlay orchestration; a derived computed is simpler and testable.

### 2. `collapsed` prop on `SideDrawer` + `BottomSheet`

Both core components gain a boolean `collapsed` prop. When true:

- Body content (default slot) is hidden.
- Header renders title only (right-aligned on desktop per the issue screenshot; compact bar on mobile).
- Close button is hidden.
- Dismissal via backdrop click / map-background click / Escape is suppressed.
- Drag handle on mobile is hidden or made non-draggable.
- Height/width shrink to a header-only size with the same enter transition (no exit; the container stays mounted).

`SideDrawer` on mobile already delegates to `BottomSheet`, so the mobile collapsed behavior flows through automatically once `BottomSheet` supports it.

Alternative considered: a new wrapper component for collapsed state. Rejected — same component staying mounted preserves slot children (the `TourForm` Vue state) so in-progress inputs survive round-trips to the picker without extra plumbing.

### 3. `disabled` prop on `TourForm` + `fieldset` wrapping

All inputs + non-picker action buttons go inside a `<fieldset :disabled="disabled">`. The active pick-target button (the crosshair that was clicked) may also be disabled because picking-in-progress is already covered by the picker FABs.

Rationale: native `fieldset[disabled]` disables nested form controls with zero extra wiring and is accessible.

Alternative considered: per-input `:disabled` bindings. Rejected — more code, easier to miss a control.

### 4. Submit guard in both `TourInfoSheet.handleEditSubmit` and `TourCreationDialog` submit

Rationale: belt-and-suspenders. Even with a disabled fieldset, keyboard Enter or a stray programmatic submit could still fire. Guard returns early if `mapStore.isPickingLocation` is true.

### 5. Cover start / end / goal uniformly

`map-store` already tracks which field the picker is editing (either via a discriminator or via existing `editPickedPoint` plumbing). The collapse behavior is indifferent to which field triggered the pick — the computed watches `isPickingLocation` only. No new state required.

## Risks / Trade-offs

- **[Risk]** Collapsed drawer on desktop must not overlap the picker Cancel/Confirm FABs → **Mitigation:** position collapsed header at top-right (per issue screenshot). Visual check covered by component test + manual QA.
- **[Risk]** Users may expect to see the form values while picking, to compare → **Mitigation:** the title includes the tour name; confirm/cancel restores the full form with picked coordinates applied. Matches issue-specified expected UX.
- **[Risk]** Collapsed BottomSheet with suppressed backdrop-click could feel trapped on mobile → **Mitigation:** picker Cancel is always visible and restores the sheet. Document in spec that this is intentional.
- **[Risk]** Native `fieldset[disabled]` has historical layout quirks with flex in some browsers → **Mitigation:** already used elsewhere in the codebase; if issues arise, fall back to `pointer-events: none` + `aria-disabled="true"` on the wrapper plus per-control `:disabled`. Verify during implementation.
- **[Trade-off]** We keep picker coordination in a shared flag rather than promoting to `activeOverlay`. Simpler now, but future overlays will repeat the pattern. Acceptable for a targeted bug fix.

## Migration Plan

- No data migration. Ship behind normal PR review.
- Rollback: revert the PR — purely client-side UI change.

## Open Questions

- None blocking. Implementation will confirm whether `map-store` already exposes the picker field discriminator or whether we rely on `editPickedPoint` prop plumbing as-is.
