## Context

Mobile bottom sheets sit in a `.sheet-container` that is `position: fixed; bottom: 0` (`map-page.vue:770`), stacked over a full-screen MapLibre map. `bottom-sheet.vue` computes its own height (`currentHeight`) from snap points (`window.innerHeight * 0.4/0.7`) or, in fit-content mode, `min(content, 70vh)`.

The on-screen keyboard breaks this for **edit forms**: on iOS the layout viewport (`window.innerHeight`) does **not** shrink (Android's default `interactive-widget: resizes-visual` is the same), so the keyboard overlays the fixed sheet and the browser auto-scrolls the focused input, dragging the whole fixed layer (sheet + map) around. Two iterations tried to keep the form *in* the sheet and resize it around the keyboard via the visual viewport — first shrinking (`S − K`), then expanding to a full page (`H − K`). On real devices both were buggy and noisy: dragging the sheet moved the map behind it and broke the layout; the keyboard produced flicker and gaps.

**Pivot:** stop fighting it. An edit form has no reason to share the screen with the map. On mobile, data entry leaves the bottom sheet and renders as a dedicated full-screen page — no map behind, no drag, nothing to misalign. The bottom sheet becomes a view-only surface again.

## Goals / Non-Goals

**Goals:**
- Mobile data entry (edit/create) renders as a full-screen page: opaque, covers the map, no drag/snap; returns to the bottom sheet on save/cancel.
- Primary action (Save) stays reachable above the keyboard — it lives in a fixed top app bar.
- The bottom sheet is simplified back to view-only; the keyboard/visual-viewport machinery is removed.
- Consumer changes are mechanical and consistent (a `page` flag + a top-bar Save).

**Non-Goals:**
- No desktop changes — edit still uses the side drawer / dialog.
- No change to the bottom sheet's drag mechanics. (View-mode sizing does change: the cap moves to 70vh, and the tour list / tour info sheets switch from snap to fit-content like every other view sheet.)
- Not converting small modal inputs that don't exhibit the bug (OTP over a dim backdrop; contact search in a list) — left as sheets, flagged for confirmation.
- The density pass tunes spacing only — no layout restructuring beyond keeping consumers aligned.

## Decisions

**1. A dedicated `full-screen-page.vue` primitive, not another bottom-sheet mode.**
The page is its own component: `position: fixed; inset: 0`, opaque, `z-index` above the map, a fixed top app bar (cancel + a `page-action` slot) and a scrolling body. It has no drag, snap, or height math.
- Rationale: the bottom sheet's snap/drag/fit machinery is irrelevant to a page; bolting a "page mode" onto it would entangle two unrelated layouts. A separate primitive keeps each focused, and `bottom-sheet.vue` shrinks back to view-only.
- Keyboard: with the page full-height and the body scrolling, the browser scrolls the focused input into view natively; the fixed top bar keeps Save visible. No `visualViewport` math needed at all.
- **`Teleport to="body"`.** The page renders inside `map-page`'s `.sheet-container`, which gets a `transform` during its open/close transition. A transformed ancestor becomes the containing block for `position: fixed` descendants, so mid-transition the page stopped resolving against the viewport and collapsed into the sheet box — leaving a sliver of map above it (intermittent: only while the transform was applied). The page teleports to `<body>` so it is never nested under a transformed ancestor and resolves against the viewport at all times.

**2. Selection lives in `adaptive-overlay` (and `tour-info-sheet`'s `:is`).**
`adaptive-overlay` gains a `page` prop: mobile + `page` → `full-screen-page`; mobile → bottom sheet; desktop → dialog/drawer (unchanged). It forwards all slots so consumers pass `#page-action` (Save) and `#footer` through unchanged. `tour-info-sheet` picks its surface directly, so it adds `full-screen-page` as a third `:is` target gated on `!isDesktop && mode === 'edit' && !isPicking`.
- Rationale: one decision point per surface-picker. Consumers stay declarative — they flip `page` from their own edit/create state.

**3a. Contact data entry: lift edit mode to the parent.**
Contact creation is the add form inside `contacts-list-sheet` (the `contact-creation-dialog.vue` file is unused/dead). Contact *editing* is `contact-detail-view`, whose view/edit `mode` lived inside the component. Surface selection (`contactPage`) depends on that mode, but swapping the host sheet → page **remounts the slotted child**, which would reset its mode to `view` and toggle the surface back — an infinite flip. So `mode` is lifted to `contacts-list-sheet` via `defineModel('mode')`: the parent owns it, and when the child remounts into the page the parent re-supplies `edit`. (Tour/profile edit never hit this because their mode already lived in the parent.) `contact-detail-view` gains an `embedded` prop that hides its own header + bottom Save/Cancel, and exposes `saveAll`/`cancelEdit`/`isSaving` so the page's top bar drives them.

**3b. A map-needing pick falls back to the collapsed sheet, not the page.**
Tour create/edit can pick a location mid-form. The page would hide the map, so while `isPicking` the surface drops back to the collapsed bottom sheet (existing behavior). Hence `page = !isPicking` (creation) / `editAsPage = mode === 'edit' && !isPicking` (edit).

**4. Forms submit via the native `form=` attribute; cancel via an exposed method.**
Each form (`tour-form`, `contact-form`, profile edit) gains `formId` + `embedded`. `embedded` hides the in-form action row; the page's top-bar Save is a `<button type="submit" :form="formId">`, so it submits the form across the DOM with no imperative wiring. The form's submit handler already validates and is guarded (e.g. `tour-form` adds an `isUploadingGpx` guard since the external button bypasses the disabled attribute). The page's top-bar **cancel** routes through the form's cleanup: `tour-form` exposes `cancel()` (orphaned GPX / staged attachments); the inline-form consumers call their local cancel directly.
- Rationale: native `form=` avoids refs/`defineExpose` for the common case; only `tour-form`'s cleanup-on-cancel needs an exposed method.

**5. Remove the keyboard machinery.**
`use-keyboard-inset.ts` (+ test), the `--keyboard-inset` var publish/reset, `.sheet-container { bottom: var(--keyboard-inset) }`, and the `bottom-sheet.vue` `currentHeight`/`--fullscreen` math are all deleted. `currentHeight` collapses to `restingHeight`; the drag guard drops the `inset > 0` clause. The sheet is plain view-only again, capped at 70vh (the expanded snap is `innerHeight * 0.7` and the CSS ceiling is `max-height: 70vh`), so the map keeps at least 30% of the viewport.

**6. Compact chrome as a soft, visual requirement (density pass).**
Trim non-content chrome in `bottom-sheet.vue` — **padding, margins, gaps** — so more area goes to information: reduce content horizontal padding from `spacing-xl` (24px) toward `spacing-md` (reclaims ~13% horizontal), tighten header `padding-bottom` and footer padding. These are *starting* values, tuned on-device.
- **Soft requirement, no hardcoded floor.** UI/UX density is judged per control by visual inspection, not a magic number. Controls must stay comfortably tappable, but each control's usable size is a design decision that may change; we do **not** mandate explicit min sizes or assert sizes in a test.
- **visible size == hit area.** No invisible hit extensions — a tap target that's bigger than what it looks like causes confusing behavior.
- **Separation stays perceptible.** Compact ≠ cramped; keep dividers/borders and a readable `gap` between groups.
- **Tune the primitive, audit consumers.** The chrome lives in `bottom-sheet.vue`; the per-consumer audit (e.g. `tour-info-sheet`'s action row) only catches places that add their own padding or assume the old metrics.
- **Independence:** touches no JS logic; ships as its own commit/PR; can land before or after the page work.

## Risks / Trade-offs

- **iOS `position: fixed` during keyboard** → a full-screen fixed page with an internal scroller is the standard, robust pattern; even if Safari nudges the layer, there's no map to misalign and Save stays in the fixed top bar. The reported drag/flicker came from the sheet sharing the screen with the map, which the page eliminates.
- **Per-form wiring** → each form needs `formId` + `embedded` and the consumer a top-bar Save. Mechanical and consistent, but it is real surface area across ~6 files; the trade-off was accepted over keeping Save at the bottom (covered by the keyboard).
- **`tour-form` cancel cleanup** → routed through an exposed `cancel()` so the page's top-bar cancel still rolls back orphaned GPX / staged attachments.
- **Density is visual-only** → no automated guard; regressions caught on-device.
- **Deliberate exceptions** → OTP (dim-backdrop modal) and contact search (list) stay bottom sheets; they don't show the bug and paging them is disproportionate. Flagged for the user.
- **happy-dom can't assert the page/keyboard visuals** → component tests cover the surface-selection logic; the visual result is verified on-device via the preview deploy.

## Migration Plan

Pure presentation, no migration. Rollback = revert the new `full-screen-page` primitive + the consumer/​form wiring; no data or schema touched.

## Open Questions

- Should the OTP modal and contact search also move to full-screen pages, or stay as bottom sheets (current decision)?
