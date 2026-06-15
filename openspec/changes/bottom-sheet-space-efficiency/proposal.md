## Why

Bottom sheets have limited screen real estate, and that space must be used as effectively as possible to show relevant information. Two problems waste it today:

1. **Keyboard handling.** When the on-screen keyboard opens on mobile/PWA, the layout viewport does not shrink on iOS (and Android's default `interactive-widget=resizes-visual` behaves the same), so the `position: fixed; bottom: 0` `.sheet-container` ends up behind the keyboard. The browser then auto-scrolls the focused input into view, shoving the whole fixed layer — sheet *and* the map above it — up and out of view. Any bottom sheet with a text input (tour-info edit, contact/tour creation, profile, OTP) is affected.
2. **Wasted chrome.** Non-content chrome eats the limited space: the content's horizontal padding is `spacing-xl` (24px × 2 = 48px, ~13% of a 360px screen), plus generous header/footer padding and the gaps reserved around the drag handle and the edit/delete and cancel/save action buttons. This pushes relevant information out of view and forces extra scrolling.

We want **edit/create on mobile to leave the bottom sheet entirely and render as a full-screen page** (no map, no drag) so the whole screen serves the form and there's nothing to misalign, **and** the sheet's non-content chrome trimmed so the maximum area goes to information — without sacrificing tap-target size or visual separation.

## What Changes

### Mobile: full-screen page for data entry (bottom sheet is view-only)

Earlier iterations tried to keep edit forms inside the bottom sheet and resize it around the keyboard (first shrinking it `S − K`, then expanding it to a full page above the keyboard via a `visualViewport` inset). Both were buggy and noisy on-device: dragging moved the map behind the sheet, and the keyboard produced flicker and gaps. The simpler, robust approach is to stop fighting it — when the user enters data, replace the sheet with a dedicated page.

- Add `core/components/full-screen-page.vue`: an opaque, full-viewport (`position: fixed; inset: 0`) surface with a fixed top app bar (cancel + a `page-action` slot for Save) and a scrolling body. No drag, no snap, no map behind. Because Save lives in the fixed top bar, the keyboard never hides it.
- `adaptive-overlay.vue` gains a `page` prop: on mobile it renders `full-screen-page` when `page` is set, the bottom sheet otherwise (desktop is unaffected — still the dialog/drawer). `tour-info-sheet.vue` (which picks its surface directly) adds `full-screen-page` as a third `:is` target for mobile edit.
- Each data-entry consumer drives `page` from its edit/create state: `tour-info-sheet` (edit mode), `tour-creation-dialog`, `user-profile-sheet` (editing), and `contacts-list-sheet` (its add form, and a contact open in edit mode via `contact-detail-view`). A flow that needs the map (location pick) falls back to the collapsed bottom sheet instead of paging.
- For contact editing, the view/edit `mode` is lifted into `contacts-list-sheet` (via `defineModel`) so it survives the sheet → page remount; `contact-detail-view` gains an `embedded` prop (hides its own header + Save/Cancel) and exposes `saveAll`/`cancelEdit` for the page's top bar.
- The forms (`tour-form`, `contact-form`, profile edit) gain a `formId` + `embedded` pair: `embedded` hides their in-form action row, and a top-bar `page-action` Save button submits them via the native `form=` attribute. The page's top-bar cancel still runs each form's cleanup.
- **Remove the keyboard machinery** entirely — `use-keyboard-inset.ts`, the `--keyboard-inset` CSS var, and the `bottom-sheet.vue` height/`--fullscreen` math. The bottom sheet reverts to a simple view-only surface capped at 70vh (map keeps ≥30% of the viewport).

### Compact space usage

- Trim the `bottom-sheet.vue` non-content chrome — **padding, margins, gaps** — so more of the sheet shows information: reduce content horizontal padding (from `spacing-xl`), tighten header and footer padding.
- **Soft requirement, no hardcoded floor:** UI/UX density is judged per control by visual inspection — controls stay comfortably usable, with **visible size == hit area** (no invisible hit extensions), and grouping separation (dividers/borders/`gap`) stays perceptible. We do not mandate fixed min sizes or assert sizes in a test.
- Audit the sheet consumers with the heaviest button bars (notably `tour-info-sheet` action buttons and the creation/profile forms) so trimming the primitive doesn't leave a consumer cramped or misaligned.
- Raise the sheet's max height to 70vh (expanded snap `innerHeight * 0.7`) so the map keeps ≥30% of the viewport, and switch the `tour-list-sheet` / `tour-info-sheet` view surfaces from snap to fit-content so every view sheet hugs its content consistently.

This density work is **mechanically independent** of the page work and SHALL ship as its own commit (and may be split into its own PR) for reviewability.

## Capabilities

### Modified Capabilities

- `bottom-sheet`: add a requirement that mobile data entry uses a full-screen page (bottom sheet is view-only; map hidden during edit, restored on save/cancel; a map-needing pick falls back to the collapsed sheet; desktop unchanged); add a requirement that the sheet uses space efficiently — compact padding/margins/gaps while keeping controls comfortably usable (visible size == hit area) and grouping separation visible.

## Impact

- **New file:** `core/components/full-screen-page.vue` (teleported to `<body>` so a transformed sheet-container ancestor never becomes its containing block).
- **Removed:** `core/composables/use-keyboard-inset.ts` (+ its test) and the `--keyboard-inset` machinery in `bottom-sheet.vue` / `map-page.vue`.
- **Changed:** `core/components/adaptive-overlay.vue` (`page` prop + slot forwarding), `core/components/bottom-sheet.vue` (keyboard math stripped; view-only + compact spacing), `tour-info-sheet.vue` / `tour-creation-dialog.vue` / `user-profile-sheet.vue` / `contacts-list-sheet.vue` (page mode + top-bar Save), `contact-detail-view.vue` (`embedded` prop, `mode` via `defineModel`, exposes `saveAll`/`cancelEdit`), `tour-form.vue` / `contact-form.vue` (`formId` + `embedded`).
- **Removed:** `contact-creation-dialog.vue` (+ its test) — dead code, rendered nowhere; its import-branch logic is already covered by `use-contact-import.test.ts`. The live contact add/edit surface is `contacts-list-sheet.vue`.
- **Deliberately left as a bottom sheet:** `phone-verification-dialog` (OTP) — a small single-field modal rendered over its own dim backdrop (not over the interactive map), so it does not exhibit the drag/flicker bug; converting a one-field modal to a whole page is disproportionate. Contact **search** likewise stays a list/browse sheet. Flag for the user to confirm.
- **No DB / API / dependency changes.** Pure presentation.
- **Verification:** real iOS *and* Android mobile/PWA via the PR preview deploy — page behavior and visual density cannot be asserted in happy-dom; the density check is a visual sign-off that controls stay tappable and content is more visible.
