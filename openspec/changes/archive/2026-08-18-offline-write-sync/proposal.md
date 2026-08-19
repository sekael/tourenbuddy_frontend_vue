## Why

This is the **offline-write-sync** change of the offline story for issue #245, the third and final
planned slice:

- **offline-map-support** *(merged)* — the base map renders offline.
- **offline-app-cache-sync** *(proposed)* — the data on top of the map renders
  offline (read-only cache), and writes are **blocked** offline behind a single
  `mutate()` seam.
- **offline-write-sync** *(this change)* — writes made offline are **queued**
  and **replayed** when connectivity returns, with a smart online/reachability
  signal driving the flush. This is where the architecture's "no offline data
  sync" stance is fully retired.

offline-app-cache-sync deliberately blocks offline writes rather than losing them: standing at
a trailhead with no signal, a user can *read* their planned tour but cannot edit
it. This change closes that gap — create/edit a tour, contact, profile field,
availability, or unfriend offline, and it syncs automatically once back online, with
the user never having to remember to retry. (Friend **request** actions — sending,
accepting, declining, cancelling a request — stay online-only: they depend on live
lookups (phone-registration, requester identity/name RPCs) that can't run offline, so
they are never actionable without a connection.)

offline-app-cache-sync's design (D6) already recorded every stance and hazard this change
inherits — the `mutate()` enqueue seam, the cache second-writer, the reconnect
ordering hazard, deferred notification dispatch, the full-action replay unit,
row-level LWW, the client-minted-UUID fact, and the reachability-signal ownership.
This proposal builds them.

## Relationship to offline-app-cache-sync — surviving its archive

This change references offline-app-cache-sync **only** through durable anchors, never the
transient `openspec/changes/offline-app-cache-sync/` folder (which moves under
`openspec/changes/archive/<date>-…/` when offline-app-cache-sync is archived):

- **Capability spec** `offline-data-cache` — the permanent home of offline-app-cache-sync's
  requirements after its archive applies them into `openspec/specs/`. This change's
  spec delta **MODIFIES** the `offline-data-cache` requirement *"Offline data
  mutation handling"* (block → queue+replay) and **ADDS** a new `offline-write-sync`
  capability. offline-app-cache-sync names that requirement neutrally so this MODIFY locates it cleanly
  after archive.
- **Code paths** `src/core/offline/{mutate,cached-load,entity-cache,use-online-status}.ts`
  — the seams offline-app-cache-sync creates in the codebase, durable regardless of proposal state.

**Prerequisites / sequencing:** offline-write-sync is developed on its **own** branch
(`feat/245-offline-write-sync`), cut from `main` after **two** changes land:
1. **offline-app-cache-sync** (merged + archived) — so `offline-data-cache` exists in
   `openspec/specs/` for the MODIFY to target and the `core/offline/*` seams exist in
   `src/`.
2. **atomic-tour-write-rpcs** (separate prerequisite PR) — collapses
   `createTourFromDraft`/`updateTour` to a single idempotent RPC per op — separate
   `create_tour_full` (ON CONFLICT DO NOTHING) and update-only `update_tour_full`
   (+ best-effort GPX), which replay depends on (design DC0). It keeps the standalone
   `setVisibility` toggle intact; the RPC only gains an *optional* `p_visibility` for
   the atomic create/update case.

The task lists are independent; nothing in offline-write-sync's tasks edits either
prerequisite's change folder — references use durable capability/code anchors only.

## What Changes

- **`mutate()` becomes an enqueue seam.** The wrapper offline-app-cache-sync added flips its offline
  branch from "snackbar + drop" to: **persist the mutation to a durable queue,
  apply the change optimistically to the store ref, and write it through to the
  entity cache** (so an offline app-reload keeps the pending edit). Online behaviour
  is unchanged.
- **Durable write queue** in IndexedDB (a new object store in the existing
  `tourenbuddy-data-cache` DB from offline-app-cache-sync). FIFO by insertion sequence so causal order
  survives (create-then-edit replays in order). Entries carry a serializable intent
  `{ type, payload }` plus any binary payload (e.g. a GPX `File` blob) — enough to
  **re-run the whole store action**, not just a row diff (replay unit = full action:
  DB write + GPX upload + notification dispatch).
- **Replay on reconnect** drains the queue FIFO by re-dispatching each intent to a
  registered replay handler that runs the same online path the action would.
  Sequenced **before** the reconnect refetch so a fresh server snapshot cannot
  clobber not-yet-flushed writes (the ordering hazard offline-app-cache-sync D6 flagged).
- **Deferred notification dispatch.** Actions that dispatch notifications inline
  (`notifyTourChanged`, `notifyTourInterest`, …) defer them for queued
  writes so they fire on **successful replay**, not at enqueue time (offline can't
  reach the Worker).
- **Smart, energy-efficient reachability signal**, sitting beside offline-app-cache-sync's coarse
  `isOnline`, that decides *when* to flush — derived cheaply in priority order
  (`navigator.onLine` → realtime WebSocket connection state → flush-attempt
  outcomes) with a lightweight health request only as a **last resort**. No fixed
  polling loop (battery). Flush also runs on app foreground.
- **Conflict resolution: row-level last-write-wins** on `updated_at` (the stance
  offline-app-cache-sync recorded). A queued write that lost to a newer server change is **surfaced**
  to the user, not silently dropped.
- **Failure handling / dead-letter.** Transient failures retry with capped
  backoff; permanently-failing entries (validation, RLS denial, deleted-entity,
  LWW-loser) move to a dead-letter surfaced to the user ("N changes couldn't
  sync — retry / discard"), and do **not** block the rest of the queue.
- **Friendship scope split:** friend **tours** get no queue (they are other users'
  tours — never writable). **Unfriend (`removeFriendship`) queues** like the other
  writable entities, with deferred tour-link eviction notify (DC6). Friend **request**
  actions stay online-only (block-form): sending, accepting, declining, or cancelling
  a request. They depend on live lookups (phone-registration via `findUsersByPhones`
  to resolve a target, requester identity/name RPCs to render the request) that can't
  run offline, so a request action is never actionable without a connection — their
  buttons are disabled offline (friend-requests sheet + connect prompt).
- **Architecture doc:** the PWA section's "no offline data sync" line is removed —
  read cache + write sync now both exist.

## Capabilities

### New Capabilities
- `offline-write-sync`: durable queue of offline data mutations with optimistic
  local apply, FIFO reconnect replay sequenced ahead of the refetch, deferred
  notification dispatch, row-level last-write-wins conflict handling with
  user-surfaced losers, a dead-letter for permanent failures, and an
  energy-efficient reachability signal driving the flush.

### Modified Capabilities
- `offline-data-cache`: the *"Offline data mutation handling"* requirement changes
  from **block** to **queue + optimistic apply + replay** — the `mutate()` seam
  changes from drop to enqueue. All read-cache and online-signal requirements from
  offline-app-cache-sync are unchanged.

## Impact

- **New core code (`src/core/offline/`):**
  - `write-queue.ts` — IndexedDB FIFO queue (new object store in `tourenbuddy-data-cache`,
    `DB_VERSION` bumped): `enqueue`, `peekAll`, `dequeue`, `deadLetter`, blob-capable
    entries.
  - `replay.ts` — `replayQueue()` drain loop + a `type → handler` registry the
    stores populate; backoff/retry, dead-letter, and dependency-aware skip (a
    dead-lettered create cascades to its dependent edits by entity id).
  - `use-reachability.ts` — the layered reachability signal (native-first, ping
    last-resort) and the flush trigger (reachable transition + app foreground).
  - `mutate.ts` *(modified from offline-app-cache-sync)* — offline branch now enqueues + applies
    optimistically + persists cache, and returns a "saved offline, will sync"
    result instead of dropping.
- **Stores (`features/*/presentation/stores/`):** each in-scope mutation action
  supplies `mutate()` a serializable intent + an optimistic local apply + registers
  a replay handler; inline `notify*` calls move into the shared success path so
  replay can fire them. `tours-store`, `contacts-store`, `user-profile-store`,
  `availability-store`, and `friendships-store` (unfriend `removeFriendship` only).
  `friendships-store`'s friend-**request** actions stay online-only (block-form
  `mutate`); friend-tour reads untouched. *(Follow-up:* `notifications-store` push/email/
  per-type toggles wire the same pattern under their own `kind:'notif-prefs'` entity —
  disjoint `user_profile` columns from `kind:'profile'`, replay reconciles the push
  subscription and skips the LWW gate to avoid false-conflicting the user's own profile
  replay on the shared row `updated_at`.)
- **Reconnect sequencing:** the per-store realtime `onSubscribed` refetch awaits a
  shared "replay drained" gate so flush precedes overwrite.
- **UI:** pending-sync indicator (queued count), a "saved offline" toast on enqueue,
  and a dead-letter review surface (retry / discard). i18n keys in `en.json` +
  `de-CH.json`.
- **DB / migrations:** the LWW mechanism *may* require a migration (a `updated_at`
  column + trigger, or a conditional-update precondition) — decided in design; if
  so it follows the local-first migration workflow. No other schema change.
- **Docs:** `.claude/architecture.md` — remove the "no offline data sync" line.
- **No new npm dependency. No Worker code change** (notifications still dispatch via
  the existing `notify-dispatch` surface; only their *timing* moves to replay).
- **Explicitly out of scope:** per-field / CRDT merge (LWW only), offline writes to
  friend tours (terminal read-only), friend **request** actions (send / accept /
  decline / cancel — each needs online lookups; stay block-form with action buttons
  disabled offline — but **unfriend queues**), offline writes to **tour attachments** (large
  blobs; stay blocked offline with an online-only UI hint, DC10), Service Worker
  Background Sync API (unsupported on iOS Safari — the primary target — so replay is
  in-app on reachability), and any new offline **read** caching (that is
  offline-app-cache-sync).
