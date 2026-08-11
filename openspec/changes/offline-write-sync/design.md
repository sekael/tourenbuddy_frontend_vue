## Context

The `offline-app-cache-sync` change establishes the substrate this change builds on
(referenced by durable capability/code anchors, never by offline-app-cache-sync's change folder — see
proposal → Relationship to offline-app-cache-sync):

- `core/offline/entity-cache.ts` — per-collection last-known-good JSON cache in the
  `tourenbuddy-data-cache` IndexedDB DB.
- `core/offline/cached-load.ts` — hydrate-then-refetch load path; sole cache writer
  in offline-app-cache-sync.
- `core/offline/use-online-status.ts` — coarse module-singleton `isOnline`
  (`navigator.onLine` + events).
- `core/offline/mutate.ts` — the write seam: online runs `fn`, offline shows a
  snackbar and drops. **This change converts its offline branch.**

offline-app-cache-sync design D6 recorded the stances and hazards below; this change implements
them. Key inherited facts: the app mints client-side UUIDs *before* the DB write
(`uuidv4()` in `createTourFromDraft`), so **no temp-ID→server-ID remapping is
needed** — an offline-created row already carries its final id and FKs resolve.
The replay unit is the **whole store action** (DB write + GPX upload + notify), not
a row diff. Friend tours are terminal read-only (no queue); friendship *actions*
queue. Several actions dispatch notifications inline and must defer them to replay.

## Goals / Non-Goals

**Goals**
- A data mutation made offline is **durably queued**, **optimistically visible**,
  and **automatically replayed** on reconnect — the user never manually retries.
- Replay preserves **causal order** and re-runs the **whole action** (DB + GPX +
  deferred notify).
- Reconnect **flushes before it refetches**, so a fresh server snapshot never
  clobbers unflushed local writes.
- Flushing is driven by an **energy-efficient reachability signal**, not a polling
  loop.
- Conflicts resolve by **row-level last-write-wins**, and a losing local write is
  **surfaced**, never silently lost.
- Permanent failures **dead-letter** without blocking the queue, and are shown to
  the user to retry or discard.

**Non-Goals**
- Per-field / CRDT merge — LWW-row only (DC5).
- Offline writes to **friend tours** — terminal read-only (DC8).
- Offline writes to **tour attachments** — out of scope. Attachments are a separate
  store, not in the offline-read set, and are large binary blobs (photos/PDFs) that
  would pressure the queue's IndexedDB quota far harder than GPX's small XML. They
  stay **blocked** offline (the `mutate()` guard applies; no replay handler is
  registered), and the attachment-upload UI SHALL clearly indicate it is
  online-only (DC10).
- Service Worker **Background Sync API** — unsupported on iOS Safari (primary
  target); replay is in-app (DC7).
- Any change to offline **read** caching or the coarse `isOnline` signal — those are
  offline-app-cache-sync and stay as-is; reachability is a *new* signal beside them.
- Multi-device real-time convergence beyond what LWW + the existing realtime
  refetch already give.

## Decisions

### DC0 — Prerequisite: atomic, idempotent tour-write RPCs (separate PR, lands first)
Replay requires each write intent to be a **single idempotent** server call (DC3),
but `createTourFromDraft` today is a 4-write sequence (`create_tour_full` +
`patchVisibility` + `uploadGpx` + `patchGpxFilepath`) — a partial replay would
re-run already-applied steps and corrupt data. A **separate prerequisite change**
`atomic-tour-write-rpcs` (its own branch/PR, landing before this one) collapses it:
- GPX uploads first to its deterministic user+tour-prefixed path; the filepath is
  passed **into** `create_tour_full` / `update_tour_full` (both already accept
  `p_gpx_filepath`) — removing `patchGpxFilepath`. GPX stays **best-effort** exactly
  as online (upload fails → tour still created, filepath null).
- The RPCs gain an **optional** `p_visibility` param so a create/update can set
  visibility atomically — removing `patchVisibility` from the create/update path
  (migration: new RPC signature).
- **Create and update stay two separate RPCs, not one upsert.** `create_tour_full`
  becomes idempotent-on-retry via `INSERT … ON CONFLICT (id) DO NOTHING` (a replayed
  create whose row already committed is a safe no-op — and since coalescing finalizes
  the payload *before* replay, the committed row already holds the final state).
  `update_tour_full` stays **update-only** (`WHERE id = …`, 0 rows affected if the row
  is gone) so it can **never resurrect** a server-deleted row (DC5). The queue's `op`
  (DC1) selects the RPC: `create` → `create_tour_full`, `update` → `update_tour_full`,
  `delete` → delete. A merged upsert is rejected precisely because it can't express
  "insert-allowed vs update-only" — the anti-resurrection gate.
- **Constraint (explicit):** the standalone `setVisibility` action **stays** — the
  visibility toggle must remain independently available to users with all its
  consequences (tour-links eviction snapshot + friendship-facing effects, see
  `tours-store.setVisibility`). `p_visibility` on the RPC is *additive* for the
  atomic case; it does **not** remove or bypass the standalone toggle path.

This change then calls the matching idempotent RPC per `op` in its replay handlers —
no partial-progress tracking in the queue. The same separate-create/update,
update-only-can't-resurrect shape is the model for contacts/profile/availability
replay handlers too.

### DC1 — Coalesced per-entity write queue in IndexedDB, blob-capable
Add an object store `write-queue` to the existing `tourenbuddy-data-cache` DB
(`DB_VERSION` bump, store created in `onupgradeneeded`; same DB because it is the
same `core/offline` domain and avoids a third database — and, per DC2, lets the
cache write + queue write share one transaction). The queue holds **exactly one
entry per entity**, keyed by `entityId` — an offline create followed by offline
edits of the same tour is **one** entry (a create of the final desired state), not
a create entry plus edit entries. Entry shape:

```
{ entityId, kind, op, payload, blobs?, baseSnapshot?, baseUpdatedAt?, linkSnapshot?, seq, attempts }
```

- `op` = `create` | `update` | `delete` — the *net* effect on the server row, which
  selects the replay call (DC0/DC3): `create` → `create_tour_full`
  (`ON CONFLICT DO NOTHING`, idempotent), `update` → `update_tour_full` (update-only,
  never resurrects — DC5), `delete` → delete. It also drives the deferred
  notification copy (DC6: `create` → "created", `update` → "updated"). `create`
  sticks through later edits; `delete` overrides. (There is no separate `origin`
  field — `op` *is* the net operation.)
- `payload` = the entity's **final** desired state (structured-cloneable JSON);
  later edits overwrite it. `blobs` holds binary (a GPX `File` — IndexedDB stores
  `Blob`s natively, no base64).
- `baseSnapshot` (`op=update` only) = the entity's server-state value the **first**
  offline edit diverged from, captured from the cache before the write-through
  overwrote it. Held so an offline **discard** can restore the cache to the pre-edit
  value immediately (DC9) without a refetch. `baseUpdatedAt` = `baseSnapshot`'s
  update timestamp, held for LWW (DC5). Coalescing update-into-update keeps the
  **first** `baseSnapshot`/`baseUpdatedAt`, never the later one. (`op=create` has no
  baseline — discard drops the entity outright.)
- `linkSnapshot` (tours only) = `snapshotTourGroupContext(id)` captured at the
  **first** offline mutation, carried so replay can run the deferred eviction dispatch
  (DC6). Coalesced **keep-first** like `baseSnapshot`.
- `seq` = a monotonic insertion counter kept for **cross-entity** drain order
  (FK deps: a tour referencing a contact both created offline must write the
  contact first). Per-entity there is nothing to order; `seq` orders *between*
  entities. Coalescing preserves the entry's original `seq`.

**Coalescing rules** (applied inside the DC2 transaction when a new offline
mutation for `entityId` arrives; existing entry `e`, incoming `m`):

| existing `e.op` | incoming `m` | result |
|---|---|---|
| (none) | create | entry `op=create` |
| (none) | update | entry `op=update`, capture `baseSnapshot` + `baseUpdatedAt` |
| (none) | delete | entry `op=delete` (tombstone for a server row) |
| create | update | merge fields → `payload`; stays `op=create` |
| create | delete | **annihilate** — remove the entry entirely + drop optimistic/cache (row never reached the server) |
| update | update | merge fields; keep **first** `baseSnapshot`/`baseUpdatedAt` |
| update | delete | `op=delete` (tombstone) |
| delete | (any) | delete is terminal (UUID ids are not reused) |

- *Why coalesce instead of an append log?* One entry per entity means replay is one
  idempotent create/update/delete per entity, discard is a single-entry removal (DC9), and
  the queue can't grow unbounded from repeated edits of one tour. It also matches the
  single-source-of-truth intent: the cache holds the entity's state, the queue holds
  the single pending intent for it.
- *Why not the Cache API?* Same reasoning as offline-app-cache-sync D2 — this is
  keyed record data, not URL-shaped `Response`s.

### DC2 — `mutate()` offline branch: enqueue + optimistic apply + cache write-through
The seam grows from `mutate(fn)` to carry, for the offline path, the action's
**intent** and its **optimistic local apply**:

```
mutate({ run, optimistic, intent })
  online  → return run()                       // unchanged from offline-app-cache-sync
  offline → tx = db.transaction([cacheStore, queueStore], 'readwrite')  // ONE txn, both stores
            persistCache(intent.entityId, tx)  // write-through so an offline reload survives
            enqueue(intent, tx)                // durable queue (DC1)
            await tx.done                      // durable pair commits atomically
            applyOptimistic(optimistic)        // ref updated AFTER the durable commit
            toast('saved offline, will sync')
```

`run` is the existing online body (repo calls + GPX + notify). `optimistic` is the
store-ref mutation the action already computes today (e.g. `setVisibility` /
`setCompleted` already apply-then-rollback). `intent` is the serializable
`{ type, payload, blobs }`.

**Atomicity invariant (load-bearing).** *Every* offline mutation of local state —
the cache write-through and the enqueue/coalesce (DC1), **and** the discard-revert
(DC9) — MUST commit in a **single IndexedDB transaction spanning both object
stores**, which is possible precisely because DC1 keeps `write-queue` in the *same*
`tourenbuddy-data-cache` DB as the entity cache. Either both land or neither does,
so ref, cache, and queue never disagree at rest.
This closes the divergence window where a crash between the two writes could leave
either (a) a cached edit that will **never** replay (phantom-synced — the dangerous
case), or (b) a queued intent invisible offline. The in-memory ref is updated only
*after* the durable transaction commits, so the ref never claims a durability the
disk doesn't have.
- *Why keep `optimistic` in the action, not generic?* The ref shape is
  action-specific; only the action knows how to reflect its own change. `mutate`
  orchestrates; the action supplies the three pieces.
- *On the "three copies" concern:* the durable **source of truth is the cache**;
  the ref is a derived in-memory projection of it, and the queue is an *append-only
  intent log keyed to cache entities* — not a fourth data model, but the outbox that
  drives cache/server convergence (see the outbox pattern below). One durable txn
  keeps cache+queue consistent; refetch collapses cache+server.

### DC3 — Replay = re-dispatch the coalesced entry to a registered handler
`replay.ts` holds a `kind → handler` registry that each store populates at init
(`registerReplay('tour', entry => …)`). `replayQueue()` drains entries **ordered by
`seq`** (cross-entity FK order, DC1): dispatch each → on success remove the entry →
on failure apply DC9. Each handler makes a **single idempotent server call**
determined by `entry.op`: `create` → `create_tour_full` (`ON CONFLICT DO NOTHING`)
or equivalent create for contacts / profile / availability / friendships;
`update` → `update_tour_full` (update-only, never resurrects) or equivalent;
`delete` → the delete; + best-effort GPX where relevant. Then the **deferred**
notify (DC6), keyed on `entry.op`. A retried replay of the same entry is safe
(idempotent) and
behaviorally identical to having done it online. Handlers never replay a multi-write
sequence (DC0 removes that) and never see more than one entry per entity (DC1
coalesces).
- *Why a `kind → handler` registry, not storing the function?* Functions aren't
  durable/serializable across reloads; a `kind` tag + a code-resident registry is,
  and it keeps the queue independent of closure state.

### DC4 — Reconnect ordering: flush drains before the refetch overwrites
The hazard from offline-app-cache-sync D6: the per-store realtime `onSubscribed` refetch will
overwrite the store+cache with server state that lacks unflushed writes if it runs
first. Resolution: a module-level `replayDone` gate (a promise that resolves when
`replayQueue()` finishes a drain). The **`onSubscribed` transition is the single
event that both kickstarts the drain and gates the refetch** (DC7): when the channel
(re)subscribes, `replayQueue()` starts, and that same store's `onSubscribed` refetch
path `await`s `replayDone` before it assigns. Net order: **flush queue → then
refetch/overwrite**, so the refetch sees the server state that *already includes* the
just-flushed writes. (Foreground / new-enqueue nudges, DC7, also start a drain; the
refetch gate only matters on the reconnect path.)
- *Why flush-then-refetch, not refetch-then-reapply?* Reapply would need to
  re-derive optimistic state after an overwrite — more moving parts. Draining first
  makes the subsequent refetch authoritative and conflict-collapsed.
- The `onSubscribed` callbacks are per-store config (`tours-store.ts`), so wrapping
  them to await the gate is local and reversible.

### DC5 — Conflict resolution: row-level last-write-wins on `updated_at`, loser surfaced
On replay, the winner of a concurrent edit is decided by newest `updated_at`
(row-level, whole-row). Two candidate mechanisms, decided in implementation:
- **(i) client-side compare:** replay reads the current server `updated_at`; if it
  is newer than the queued entry's `baseUpdatedAt`, the server won → the queued
  write is **not** applied and is surfaced to the user ("a newer version exists").
  No migration.
- **(ii) DB-side precondition/trigger:** a conditional update guarded on `updated_at`
  (or a LWW trigger). More robust against races, but requires a **migration** (local
  -first per project workflow) and touches schema.

Default to (i) unless the race window proves material; either way the **losing local
write is shown to the user, never silently dropped** — matching offline-app-cache-sync's honesty
principle. Per-field/CRDT merge is explicitly rejected as over-built for
mostly-single-user data.

**LWW governs `op=update` only.** The other two ops sit outside the timestamp
compare:
- **`op=delete` wins unconditionally.** A user's offline delete replays regardless of
  any concurrent server edit — deletion is a deliberate terminal intent, and
  honouring it beats "your delete didn't take because the row was renamed." Safe
  because writable entities are user-owned (RLS-scoped), not collaborative.
- **`op=update` must never resurrect a server-deleted row.** Replay uses the
  **update-only** `update_tour_full` (DC0): if the row is gone (0 rows affected /
  404), the entry **dead-letters** with "this was deleted" (DC9) — it does **not**
  re-insert. Only `op=create` may insert. This anti-resurrection gate is *why* DC0
  keeps create and update as separate RPCs rather than one blind upsert.

### DC6 — Deferred notification dispatch, keyed on coalesced `op`
Inline `notify*` calls (`notifyTourChanged` in `createTourFromDraft`/`updateTour`,
`notifyFriendRequestReceived` in the friend-request path, etc.) move into the shared
success path that **both** the online `run` and the replay handler call — so for a
queued write the notification fires on **successful replay**, when the Worker is
reachable, and exactly once. Enqueue fires **no** notification. The **net** effect
drives the copy: a coalesced entry replays the notification for its `op`
(DC1) — an `op=create` entry (even after later edits) notifies **"created"** (the
server sees one new row), not "updated"; an `op=delete` entry notifies the delete.
The annihilated create-then-delete entry (DC1) replays nothing and notifies
nothing — correct, the row never existed server-side.
- *Correctness risk:* double-send (enqueue + replay) or missing send. Guard: notify
  lives only in the post-write success path; enqueue never calls it. Covered by a
  test asserting an offline mutation dispatches zero notifications until replay
  succeeds, then exactly one keyed on `op`.

**Deferred eviction dispatch (tours + tour-links).** `updateTour` / `setVisibility`
/ `deleteTour` are not a plain `notify()` — they (1) `snapshotTourGroupContext(id)`
**before** the write, (2) write (tripping the DB eviction trigger
`fn_evict_member_on_tour_change`), (3) `dispatchEvictionIfHappened(snapshot, id)`
**after**, reading post-write DB state. Offline these halves split across time: the
snapshot is captured **at enqueue** (the link-group audience as it stood, coalesced
**keep-first** like `baseSnapshot`) and carried on the entry as `linkSnapshot`; the
eviction dispatch runs **at replay** (`write → dispatchEvictionIfHappened(entry.linkSnapshot, id)`),
when the trigger's real side effects exist. **Bounded risk:** the eviction itself is
done by the DB trigger at replay regardless — only the *notification* to the evicted
member is deferred, and it is already best-effort (`.catch()` + warn) online, so a
stale snapshot means a possibly-missed eviction **notification**, never wrong
eviction **state**.
- *Principle:* notifications are **secondary** in offline features — every deferred
  dispatch (change, interest, eviction, friend-request) is best-effort on replay.
  Offline never blocks or fails a write because a notification might not land.

### DC7 — Energy-efficient reachability, native-first, ping last resort
`use-reachability.ts` separates two concerns that must not be conflated: a
**reachability predicate** ("is the backend reachable right now?") and the **flush
triggers** ("what concrete event kickstarts a drain?"). No fixed polling loop (the
realtime energy section forbids sustained background work).

**Reachability predicate**, layered cheapest-first:
1. `navigator.onLine === false` → definitely not reachable (free, from
   offline-app-cache-sync's `isOnline`). `=== true` is **not** proof of reachability
   (coarse — interface up ≠ server reachable).
2. **Realtime WebSocket state** — the app already holds a Supabase realtime channel;
   its `SUBSCRIBED` vs disconnected status (`use-realtime-subscription.ts` `status`)
   is a near-free *proven* reachability signal (an authenticated round-trip to
   Supabase actually succeeded).
3. **Flush-attempt outcomes** — a failed flush marks not-reachable + schedules a
   backed-off retry; a success marks reachable. The queue's own traffic is the probe.
4. **Last resort only:** if a write is pending, the queue is non-empty, and tiers
   1–3 are inconclusive (e.g. realtime disabled), a single lightweight `HEAD`/health
   request, capped and backed off — never a periodic ping.

**Flush triggers (the kickstart signal).** The **authoritative** kickstart is the
**realtime WS reaching `SUBSCRIBED`** — the `onSubscribed` transition — because it is
*proven* reachability, and it is the **same event DC4 gates the refetch on** (one
event kickstarts the flush *and* the refetch awaits `replayDone`). Additional
triggers, all cheap nudges layered on top:
- **app foreground** (`visibilitychange` → visible), reusing the realtime layer's
  visibility signal;
- a **new enqueue while already reachable** (flush immediately — don't wait for an
  offline→online edge that won't come if you were online all along);
- a **backed-off retry** after a failed flush (DC9).

The coarse `online` window event is treated as *at most* a nudge, **never** the
authoritative kickstart — relying on it would fire flushes on false positives that
immediately fail. Background Sync API is rejected (iOS Safari lacks it).
- `// ponytail: kickstart = WS SUBSCRIBED (proven reachable) = the same onSubscribed
  DC4 uses; onLine/foreground are nudges. Health-ping is the last tier, not a loop.`

**Replay-trigger ceiling (known limitation).** Without Background Sync, replay only
runs while the app is **open + foregrounded + reachable**. So offline edits sync the
next time the user opens the app online — if they never reopen it online, the queue
sits durably but unsynced. This is the honest ceiling of a PWA without Background
Sync (unsupported on iOS, the primary target); chasing eventual-sync via background
wake / push-triggered sync is either unsupported or the battery/complexity sink DC7
already rejects. Mitigation is **visibility, not magic**: the pending-sync indicator
(task 8.1) is **durable** — it reads the queue on every launch (even offline) and
shows "N changes waiting to sync", so the user always knows there is unsynced work,
and opening the app online flushes it with no user action. We do **not** try to
intercept app-close to warn — mobile browsers don't fire reliable close events, so
that would be a false-confidence half-feature. The durable indicator is the right
mitigation precisely because we *can't* guarantee eventual sync; making the pending
state honestly visible beats a promise the platform won't keep.

### DC8 — Queue scope: writable entities only
Enqueue applies to tours (owned), contacts, profile, availability, and **friendship
actions** (send / accept / decline a friend request — with deferred notify, DC6).
**Friend tours are never enqueued** — no writable action exists on them; they stay
pure read cache from offline-app-cache-sync. This keeps the replay registry to the actions that can
truly originate offline.

### DC9 — Failure handling & discard: capped retry, dead-letter, immediate revert
- **Transient** failure (network, 5xx, timeout): retry with capped exponential
  backoff + jitter; `attempts++`.
- **Permanent** failure (validation/RLS 4xx, deleted-entity 404, LWW-loser DC5, or
  `attempts` exceeds the cap): move the entry to a **dead-letter** and continue
  draining — one bad entry never blocks the queue (no head-of-line stall).
- **Cross-entity dependency cascade:** because DC1 coalesces per entity, there is no
  same-entity create-then-edit pair to cascade. But a **create for entity A that
  dead-letters** cascades to any pending entry whose `payload` references A (e.g. a
  tour whose `partnerIds` include a contact created offline that failed) — those are
  dead-lettered too, since replaying them against a never-created row would 404.
- **Immediate revert (not refetch-gated).** Discard — user-initiated on a
  dead-lettered *or* a still-pending write — reverts **synchronously in one DC2
  transaction**: remove the entity's queue entry and restore its cache entry to the
  retained server baseline (`op=create` → drop the entity entirely; `op=update`
  → restore the pre-edit snapshot the `baseUpdatedAt` refers to), then repaint the
  ref. It does **not** wait for a refetch — offline there is none, and the user
  explicitly discarded, so the change must disappear now. Granularity is **per
  entity** (matching DC1's one-entry-per-entity); there is no surgical mid-stack undo
  because there is no stack.
- Dead-lettered entries surface to the user ("N changes couldn't sync") with
  **retry** (re-attempt the same entry) and **discard** (the immediate revert above).

### DC10 — Attachment upload is online-only, surfaced clearly in the UI
Tour attachments are out of scope for offline writes (Non-Goals). The attachment
store's mutations stay behind the `mutate()` block (no replay handler), so offline
they no-op instead of queuing. Because everything *else* the user does offline now
silently succeeds (queued), an attachment action that quietly does nothing would be
confusing. So the attachment-upload UI SHALL, while offline, **visibly disable** the
add/upload control and show a clear "attachments are available online only" hint —
distinguishing "this one thing needs a connection" from the general saved-offline
behavior. Read of existing attachments is unaffected (served from wherever they are
already cached).

## Risks / Trade-offs

- **LWW data loss on genuine concurrent same-row edits.** Accepted stance for
  mostly-single-user data; the loser is surfaced (DC5), not silent. Per-field merge
  was rejected as over-built.
- **Cross-entity dependency tangles.** Coalescing removes same-entity stacks (DC1),
  so the remaining trap is a failed create stranding another entity that references
  it. Entries replay in `seq` order so a referenced row (created first) lands first;
  a create that dead-letters cascades to referencing entries (DC9). Tested for the
  tour+partner-contact case.
- **Replay-trigger ceiling.** Without Background Sync, offline edits only sync when
  the app is next opened online (DC7). Not data loss (durable queue), but unsynced
  work can sit indefinitely. Mitigation: the durable pending-sync indicator makes it
  always visible; accepted as the honest PWA limitation.
- **GPX blob size in the queue.** A queued tour carries its GPX `File`; several
  large offline creates could pressure IndexedDB quota. Mitigation: the same
  `navigator.storage.estimate()` guard pattern offline-app-cache-sync/offline-map-support use; block enqueue with a
  clear message if quota is short rather than corrupt the queue.
- **Notification timing bugs** (double/again/missed) — the highest-risk refactor.
  Centralizing notify in the shared success path (DC6) + a zero-notify-until-replay
  test is the guard.
- **Reachability false-positive flush storms** — a flapping connection retrying
  hard. Mitigation: backoff + jitter (DC9) and the WS-state tier (DC7) damping the
  churn.
- **`updated_at` availability.** DC5(i) needs a reliable server `updated_at` per row;
  if a table lacks one, DC5(ii)'s migration is required for that table. Audited in
  implementation.

## Open Questions

- **LWW mechanism** DC5(i) client-compare vs DC5(ii) migration — pick per measured
  race window and per-table `updated_at` availability; DC5(ii) adds a migration under
  the local-first workflow.
- **Does the health-ping tier (DC7.4) ever fire in practice**, or do WS-state +
  flush-outcomes fully cover reachability? Measure; drop the tier if unused.
- **Whether friendship-action replay needs idempotency keys** beyond LWW (a
  double-sent friend request) — likely yes; confirmed against the friendship
  uniqueness constraints during implementation.
