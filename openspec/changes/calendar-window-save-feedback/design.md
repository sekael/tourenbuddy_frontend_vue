# Design

## Context

`calendar-sync-settings.vue` seeds `coreStart` / `coreEnd` / `minFree` refs from `store.settings` and calls `store.saveSettings()`, which returns `true` on success (and then runs a sync when feeds exist), `false` on validation or network failure. After success the store's `settings` equal the form values.

## Goals / Non-Goals

**Goals:** dirty gating, visible in-place confirmation.

**Non-Goals:** feed add/remove/relabel (they apply immediately, no save button); moving the shared store `error` message next to the form; snackbar infrastructure.

## Decisions

- **Dirty = form differs from `store.settings`** (computed). No snapshot copy: the store's settings are the backend truth after load and after a successful save, so the comparison self-resets.
- **In-place button confirmation over a snackbar:** the user is looking at the button; the sheet has no snackbar host; the outbound-feed "Copy → Copied" button already uses the same in-place pattern. Label cycles `Save` → `Saving…` → `✓ Saved` (success colour, `role="status"` so it is announced).
- **"Saved" persists until the next edit** (not a timer): the disabled button keeps saying why it is disabled. Editing back to the saved values returns to plain disabled "Save".
- **Saving flag is local** and spans the whole `saveSettings` call (including the follow-up sync) so double submits are impossible.

## Risks / Trade-offs

- [Settings refetch overwrites an in-progress edit] → pre-existing behaviour of the seeding watcher; unchanged.
- [Failed save] → button stays enabled (still dirty); store error renders as before.
