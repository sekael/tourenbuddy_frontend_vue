## Why

Planning a tour with friends requires coordinating free days, but the app has no
notion of when a user is available. This change lets a user mark the days they can
tour directly on the planned calendar and see their own availability at a glance.
It is the foundation for GitHub #244 (sync + show friends' availability), so the
data model is deliberately shaped to make that a purely additive follow-up.
(#242, sub-issue of #20.)

## What Changes

- Users can enter an **edit-availability mode** from the planned calendar via a
  **floating action button (FAB) in the bottom-right corner**: tap a day to mark
  it available, tap again to clear; drag/swipe across consecutive days to mark a
  run. In edit mode, **Save** persists the change and **Cancel** discards, shown
  as a bottom action bar. A disclaimer states that availability will be visible to
  friends (they will be, once #244 ships).
- Editing loads the user's **entire future availability set** (all days ever
  marked, today onward), so any previously marked day can be cleared in the same
  session — not just days touched this edit. Past days are non-interactive.
- Availability persists to a **new `user_availability` table**, one row per
  available day, keyed `(user_id, date)`.
- The Planned calendar renders the user's **own availability** as a light-green
  overlay on available days, in both view and edit mode.

**Deferred to #244 (out of scope here, but the schema/RLS are designed so #244
adds only policies + triggers, no schema change):** reading friends' availability,
rendering friend contact chips + "and more" list, and realtime synchronization of
availability across devices and friends.

## Capabilities

### New Capabilities
- `calendar-availability`: own-availability end-to-end — the `user_availability`
  data model and its owner-only RLS (with grants and a table shape ready for
  additive friend-read policies), the edit-availability mode (toggle/drag,
  load-full-future-set, diff save, friend-visibility disclaimer, future-only), and
  the rendering of the user's own availability as a light-green overlay.

### Modified Capabilities
- `calendar-view`: the Planned view gains an **Edit availability** floating action
  button (bottom-right) and renders the own-availability overlay in its day cells /
  mobile day rows.

## Impact

- **Database**: new `user_availability` table (+ Data API grants, owner-only RLS
  policies) and an atomic `apply_availability_diff(added date[], removed date[])`
  SECURITY INVOKER RPC that applies a save's inserts + deletes in one transaction.
  New migration file; local-first, `supabase db push` to prod is a prompted deploy
  step. No realtime publication or trigger changes in this change (those belong to
  #244). No Worker changes.
- **Feature code** (`src/features/calendar/`): introduces the currently-absent
  `data/` layer (Zod model, Supabase repository impl), a `domain/repositories`
  interface, and a Pinia availability store (load own future rows, diff-save). New
  edit-availability FAB (reusing `core/components/round-action-button.vue`) and
  edit-mode Save/Cancel bar in `calendar-page.vue`; own-overlay rendering in
  `planned-calendar.vue`. The extended FAB (icon + visible text) needs a small new
  extended-FAB component or an `extended` variant of `round-action-button.vue`
  (which is icon-only today).
- **i18n**: new keys in `en.json` and `de-CH.json` (button, save/cancel,
  disclaimer).
- **No breaking changes**; availability is additive and independent of existing
  tour data.
