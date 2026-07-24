## Context

Every feature store follows the same load shape: a `loadX()` action calls
`repository.listX(userId)` and assigns the result to a `ref`, with `isLoading` /
`error` around it (see `tours-store.ts` `loadTours` / `loadFriendTours`,
`contacts-store`, `user-profile-store`, `availability-store`,
`friendships-store`). Data reaches these stores three ways: the initial
`loadX()`, a Realtime `postgres_changes` `onChange` refetch, and — critically — the
Realtime `onSubscribed` refetch that fires on every (re-)subscribe (see
`.claude/architecture.md` → Realtime, and the energy/visibility section: hidden →
channel torn down, visible/reconnect → re-subscribe → `onSubscribed` full
refetch). Today, all three fail hard offline: the fetch rejects and the ref is
left empty (or stale from before). Nothing is persisted across a reload.

The offline-map slice already established the local-storage primitive we mirror:
`src/features/map/data/services/offline-region-store.ts` is a small hand-rolled
IndexedDB wrapper (`openDb` / `promisify` / `withStore`) — no dependency, no
abstraction beyond what it uses. The data cache is the same primitive applied to a
different, cross-feature payload.

## Goals / Non-Goals

**Goals**
- The five store-loaded collections (owned + friend tours, contacts, profile,
  calendar availability, friendships) render **offline** from a last-known-good
  local snapshot.
- A store paints the cached snapshot **instantly** on load, then refetches and
  overwrites when online (hydrate-then-refetch).
- A single reactive `isOnline` signal drives both the network-skip in stores and
  the offline UI.
- Coming back online reconciles the cache with the server **without a new sync
  engine** — it reuses the existing Realtime `onSubscribed` refetch.
- Data mutations are **blocked offline** at the store-action level with a clear
  user notice; no half-written offline state.

**Non-Goals (deferred to offline-write-sync)**
- No offline **write queue** — no create/edit/delete while offline, no replay on
  reconnect.
- No **temp-ID → server-UUID** remapping for locally-created rows.
- No **conflict resolution engine**. Row-level last-write-wins is *recorded* here
  as the chosen future stance (D4) but nothing resolves conflicts in this slice,
  because a read-only cache has no client writes and therefore no conflicts.
- No caching of secondary/derived collections not loaded directly by a store in
  scope (tour-links, tour-attachments, user-blocks) — added only if the offline
  read UX proves to need them.
- No background/predictive prefetch — the cache is populated as a side effect of
  the normal online load path.

## Decisions

### D1 — Cache last-known-good domain entities, not raw API rows
The cache stores the **already-mapped domain entities** (the same objects the
store ref holds), serialized as JSON, keyed `<collection>:<uid>` (e.g.
`tours:<uid>`, `friend-tours:<uid>`, `contacts:<uid>`, `profile:<uid>`,
`availability:<uid>`, `friendships:<uid>`). They were validated by the Zod schema
when first fetched online; a cache read is trusted without re-validation (it is a
snapshot of our own prior output, not an external boundary).
- *Why per-uid keys?* Two accounts on one device must not read each other's cache.
  Auth logout clears the store refs already; the cache is namespaced so a stale key
  can never leak across users. (A future enhancement can purge other-uid keys on
  login; not required for correctness since reads are uid-scoped.)
- *Why entities, not raw rows?* Re-running repository mapping on every cache read
  buys nothing for read-only data and couples the cache to schema internals.

### D2 — One hand-rolled IndexedDB store in its own DB
`core/offline/entity-cache.ts` opens its own database `tourenbuddy-data-cache`
(separate from the map feature's `tourenbuddy-offline`) with a single object store
keyed by the cache key, mirroring `offline-region-store.ts` almost verbatim
(`openDb` / `promisify` / `withStore`; `get` / `put` / `clear`).
- *Why a separate DB, not a new object store in `tourenbuddy-offline`?* That DB is
  owned by the map feature and `core/` must not depend on a feature
  (`.claude/architecture.md` → Module Boundaries). A separate DB also avoids
  cross-feature `DB_VERSION` coordination — either feature can evolve its schema
  independently.
- *Why IndexedDB, not `localStorage`?* Payloads (tour lists with GPX metadata,
  contact lists) can exceed the ~5 MB `localStorage` cap and block the main thread
  on parse; IndexedDB is async and roomy. It is also the primitive already in use.
- *Why not the Cache API (as offline-map used)?* Cache API is URL-keyed and shines
  for the SW hot path serving `Response`s. This is arbitrary keyed JSON queried
  from the window — a record store, not a request store. Same reasoning that put
  the region **metadata** in IndexedDB there.

### D3 — Hydrate-then-refetch is the load path; `isOnline` gates the network
The generic helper `cachedLoad` in `core/offline/cached-load.ts` is the whole
mechanism. Each `loadX()` delegates to it:

1. Read the cached snapshot for the key; if present, assign it to the store ref
   immediately (instant paint, including a cold start with slow signal).
2. If **offline** (`!isOnline`), stop — the cached snapshot is the answer, and no
   network request is attempted (offline `fetch` would hang, not fail fast).
3. If **online**, run the fetcher (the existing `repository.listX(uid)` call),
   assign the fresh result to the store ref, and **overwrite** the cache key with
   it.

Overwrite-on-refetch is the only reconciliation this slice needs: the server is
authoritative on every successful online load, so the cache can never drift for
longer than one refetch. This is the degenerate, conflict-free case of the D4 LWW
stance. The helper also preserves the store's `isLoading` / `error` contract (a
network error while online falls back to the cached snapshot rather than blanking
the ref).

`isOnline` (`core/offline/use-online-status.ts`) is a **module-level singleton**
reactive ref seeded from `navigator.onLine` and updated by `window`
`online` / `offline` listeners — the same singleton pattern the realtime layer uses
for `pageVisible`. It is imported by stores (to gate the network) and by the UI (to
render offline state). `navigator.onLine` is a coarse signal (it means "has a
network interface", not "can reach Supabase"), which is acceptable: a false
positive just means the online path runs and its fetch falls back to cache on
failure — the same safety net as D3 step 3.

### D4 — Reconnect reconciliation reuses the Realtime `onSubscribed` refetch
No new sync loop, no `online`-event-driven bulk refetch to write. The realtime
layer **already** tears channels down when the tab is hidden / disconnected and
re-subscribes when visible / reconnected, firing an `onSubscribed` **full refetch**
for every subscribed store (architecture: "always provide an `onSubscribed`
callback that does a full refetch"). Routing those same `loadX()` actions through
`cachedLoad` (D3) means reconnect automatically overwrites the cache with fresh
server state. The offline cache is purely the read fallback for the window when
that path is down.
- *Why not also refetch on the `window` `online` event directly?* Redundant — the
  realtime resubscribe covers reconnect for the subscribed stores, and the next
  user navigation triggers `loadX()` for any that are not. Adding a second trigger
  is a second thing to keep correct for no new coverage. (If a store in scope has
  **no** realtime subscription, it gets its fresh data on the next `loadX()`; that
  is acceptable for read-only data.)

### D5 — One `mutate()` seam blocks writes offline; UI surfaces it globally
All ~20 mutation actions across the five stores (`createTourFromDraft`,
`updateTour`, `deleteTour`, `setCompleted`, `setVisibility`; contacts' add /
update / delete / method actions; profile `updateProfile` / `deletePhone` /
`setLocale`; availability `save`; friendships `accept` / `removeFriendship`) route
their body through a single thin wrapper `mutate(fn)` in `core/offline/`:

```
async function mutate(fn) {
  if (!isOnline.value) { snackbar('unavailable offline'); return }
  return fn()
}
```

Online it just runs `fn`; offline it shows a localized "unavailable offline"
snackbar and returns without touching state. A global offline indicator (banner or
pill) tells the user *why* an action did nothing.

- *Why one wrapper and not a per-action `if (!isOnline)` guard?* There are ~20 call
  sites. A per-action guard is really 20 seams that drift, and offline-write-sync would have
  to revisit **all 20** to swap "drop" for "enqueue". The wrapper is the single seam
  D6 promises: offline-write-sync changes **one** function. This is the one place in the slice we
  accept a small abstraction whose payoff is the next change — justified because offline-write-sync
  follows immediately, not "someday" (had offline-write-sync been far off, the plain guard would be
  the YAGNI-correct call).
- *Why block rather than silently queue?* Queuing is offline-write-sync. Silently swallowing
  an offline edit would risk the user believing it saved.

### D6 — Recorded stances & hazards for offline-write-sync (built here: nothing)
So the end-to-end story is coherent and offline-write-sync walks in eyes-open, this change
**records** the following and builds **none** of it. Reviewers SHOULD reject any
write-queue / tombstone / temp-ID / conflict code that tries to land in this PR —
the slice is read cache + online signal + `mutate()` block-seam and nothing else.

- **`mutate()` is offline-write-sync's enqueue seam.** offline-write-sync changes only the offline branch of the
  D5 wrapper: instead of dropping, it enqueues the mutation for durable replay.
- **Offline-write candidates vs terminal read-only.** Tours (owned), contacts,
  profile, availability, **and friendships** are offline-write candidates offline-write-sync will
  queue — friendships specifically for **friend-request send + responses** (accept
  / decline), which must work offline. **Friend tours are terminal read-only** (they
  are other users' tours; never mutated) — they get the read cache + the offline
  block here, and offline-write-sync adds **no** queue for them.
- **Cache gets a second writer in offline-write-sync.** Here `cachedLoad` is the *sole* cache
  writer (refetch-written shadow, D3). offline-write-sync must add a second writer: after `mutate()`
  applies an optimistic change to the store ref, it persists that change to the
  cached snapshot so an offline app-reload survives. The per-collection entity-JSON
  shape (D1) supports this rewrite — additive, not a redesign.
- **Reconnect ordering hazard.** This slice relies on the per-store realtime
  `onSubscribed` refetch to reconcile (D4). With a queue, that refetch will **clobber
  unflushed optimistic writes if it runs before the flush**. offline-write-sync MUST sequence
  queue-flush relative to the reconnect refetch (flush-then-refetch, or
  refetch-then-reapply-queue). No orchestrator is built now; the `onSubscribed`
  callbacks are per-store config (`tours-store.ts`) and fully wrappable in offline-write-sync.
- **Deferred notification dispatch.** Several in-scope actions dispatch notifications
  inline (`createTourFromDraft` → `notifyTourChanged`; `accept` → friend-request
  notify). A queued offline write cannot fire these at enqueue time — offline-write-sync's replay
  MUST defer notification dispatch until flush succeeds.
- **Replay unit = the full store action.** `createTourFromDraft` mints its UUID and
  also does GPX upload + notify dispatch. offline-write-sync's unit of replay is therefore the
  **entire action** (DB write + GPX blob upload + deferred notify), not just the DB
  row.
- **Reachability signal is offline-write-sync's.** `isOnline` here is coarse `navigator.onLine`
  (fine for a read gate; a false positive falls back to cache, D3). offline-write-sync owns
  flush-retry-on-failure and MUST find a **smart, energy-efficient reachability
  signal** (e.g. deriving from flush success/failure, or realtime WS state) **before**
  resorting to a Supabase health-ping loop — a periodic ping fights the realtime
  energy budget and is the last resort, not the default.
- **Conflict resolution: row-level last-write-wins**, keyed on `updated_at`. On
  replay, whichever write (local queued vs. server) is newer wins the whole row.
  Lossy on concurrent same-row field edits; acceptable for TourenBuddy's
  mostly-single-user data. Per-field merge and server-authoritative-reject were
  considered and rejected as over-built for the data shape.
- **Temp-ID strategy: not needed.** Locally-created rows already mint a client-side
  UUID (`uuidv4()` in `createTourFromDraft`) *before* the DB write — the app is
  UUID-primary-key throughout, so an offline-created tour carries its final id and
  FKs (attachments, tour-links, partners) reference it with no server round trip.
  offline-write-sync needs a durable queue + replay, **not** temp→real remapping. Recording this
  now *reduces* offline-write-sync's scope.

## Risks / Trade-offs

- **Stale reads offline.** The cache can be arbitrarily old (last time the user was
  online). Acceptable and expected for a read-only offline cache; the offline
  indicator signals the user is seeing cached data. Overwrite-on-reconnect (D3/D4)
  bounds staleness to one refetch once back online.
- **`navigator.onLine` coarseness.** It can report `true` on a connected interface
  with no real internet. Mitigation: the online path's fetch failure falls back to
  cache (D3 step 3), so a false positive degrades to "tried, used cache", never a
  blank screen or a lost write (writes are blocked, not queued, in this slice).
- **Cache/schema drift across app versions.** A future entity-shape change could
  make an old cached snapshot mismatch the current type. Mitigation: bump the
  cache's `DB_VERSION` (or a key prefix) to drop stale snapshots on upgrade; a
  missing/typed-off snapshot simply falls through to a network load. Covered by a
  test on the read path tolerating an absent/legacy key.
- **Multi-account on one device.** Per-uid keys (D1) prevent cross-user reads;
  worst case is orphaned other-uid keys consuming space until a future purge.

## Open Questions

- Whether any secondary collection (tour-links, tour-attachments) needs caching for
  the offline **read** UX to be coherent (e.g. linked-tour grouping) — decided
  during implementation by what the tours/detail views actually render offline;
  default is no, add only if a view breaks offline.
- Exact form of the offline indicator (top banner vs. status pill) — a UI detail
  settled in implementation against the design system; does not affect the data
  layer.
