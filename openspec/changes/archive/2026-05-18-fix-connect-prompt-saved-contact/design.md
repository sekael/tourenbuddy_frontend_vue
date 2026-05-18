## Context

`ConnectPrompt` (`src/features/friendships/presentation/components/connect-prompt.vue`) is reused in three call-sites in `contacts-list-sheet.vue`:

1. Add-contact form (manual entry, line 533) — secondary button = "just save the contact, skip sending request".
2. vCard import results (line 457) — secondary button = "dismiss this match".
3. Saved-contact detail view (line 412) — currently shows secondary button, but semantically the contact is already saved, so it duplicates the dismiss intent of the surrounding view.

User confirmed (issue #158) that the secondary button should only appear in detail view when the user is actively editing the contact (`mode === 'edit'` in `contact-detail-view.vue:48`).

## Goals / Non-Goals

**Goals:**
- Hide "Save contact only" button in saved-contact detail view when not editing.
- Keep both buttons during contact edit (pending edits exist; `beforeSend` already commits them).
- Preserve existing behavior at the other two call-sites by defaulting prop to `true`.

**Non-Goals:**
- Rework friendship-request UX, copy, or i18n keys.
- Change `ConnectPrompt` styling, layout, or dismissed-state persistence.
- Touch `useDismissedConnectPrompts` logic.

## Decisions

**Prop name `show-dismiss` (boolean, default `true`).** User-selected over a `mode` enum: smaller surface area, all current call-sites keep working with no change, only the detail-view call-site opts out.

**Expose `mode` from `ContactDetailView` via `defineExpose`.** The component already exposes `commitPendingEdits` via the existing `detailRef`; adding `mode` to the same expose block is consistent. Parent reads it through a `computed` against `detailRef.value?.mode`.

Alternative considered: emit `update:mode` events. Rejected — adds two-way coupling for read-only consumption.

**Conditional render, not disabled.** Hiding the button entirely (`v-if`) is clearer than rendering it disabled.

## Risks / Trade-offs

- `detailRef.value?.mode` is reactive only because Vue's template proxy unwraps the exposed ref; if a future refactor changes `mode` to a plain value the computed silently goes stale → mitigate by keeping `mode` as a `ref` and covering the toggle with a test.
- Default `show-dismiss = true` means any new call-site inherits the two-button layout. Acceptable; matches the historical default.
