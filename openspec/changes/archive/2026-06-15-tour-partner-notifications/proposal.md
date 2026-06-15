## Why

Issue #210 asks us to verify that friends are correctly notified about being a tour partner (on add, update, delete) and to document every notification the app emits. Today the add/update/delete paths all fire, but a partner **added to an existing tour** receives the generic *"X updated tour Y"* copy — their first contact with the tour is a confusing "updated" rather than a "shared with you" introduction. There is also no central documentation of the notification surface, making it hard to reason about what fires when.

## What Changes

- When `updateTour` adds one or more new partners to an existing shared tour, the newly-added friend partners SHALL receive the `created` ("shared X with you") copy, while pre-existing friend partners still receive `updated`.
- Client (`updateTour`) computes the added-partner set (`draft.partnerIds \ existing.partnerIds`) and passes it to the dispatcher; the Worker `handleTourChanged` `updated` branch splits recipients, resolving the added contact ids via the existing `resolveUsersByContactIds` helper.
- Add `docs/notifications.md`: a single source-of-truth table documenting every notification (trigger, actor, recipients, type, push/email copy EN/DE, mute key, call site).
- Document — but do **not** fix — the known gap that a **removed** partner receives no notification (the Worker resolves recipients from the live row, so an ex-partner is already absent).

## Capabilities

### New Capabilities
<!-- none: documentation is a deliverable, not a behavioral capability -->

### Modified Capabilities
- `shared-tour-notifications`: the "Notify friend partners on shared-tour changes" requirement gains a scenario — a partner added during an edit receives the new-shared-tour ("shared with you") notification, not the generic edit copy.

## Impact

- **Client:** `src/features/tours/presentation/stores/tours-store.ts` (`updateTour` add-partner diff), `src/features/notifications/data/notify-dispatch.ts` (`notifyTourChanged` gains optional `newPartnerContactIds`).
- **Worker:** `services/email-hook/src/notify.ts` (`handleTourChanged` `updated` branch splits recipients into created/updated buckets). Requires a manual `wrangler deploy` — not in CI.
- **Docs:** new `docs/notifications.md`.
- **No DB / schema changes.** No new env vars. No breaking changes.
