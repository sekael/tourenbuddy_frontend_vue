## Why

TourenBuddy is used in the mountains, where there is often no connectivity. The
first offline slice (**offline-map-support**, merged) makes the *base map*
available offline. But the moment a user goes offline today, the **data** on top
of the map disappears: opening the app with no signal shows empty tours, no
contacts, no profile, no calendar, no friends — the stores fetch from Supabase and
the fetch fails. A user standing at the trailhead with no bars cannot even read
the tour they planned last night.

This change delivers the next slice of issue #245: a **read-only offline data
cache**. The five store-loaded collections (tours, contacts, profile, calendar
availability, friendships) are cached locally so the app renders last-known-good
data offline, and a lightweight online/offline signal drives the UI. Writing data
offline (create/edit a tour with no signal and replay on reconnect) is explicitly
**out of scope here** — it is the following **offline-write-sync** change. This
change is where the architecture's "no offline data **sync**" stance is first
qualified: read caching now exists; write sync is next.

The scope split is deliberate. Reading your planned tour offline is the
mountain-critical need and ships cheaply. Offline *mutation* — a write queue,
temp-ID → server-UUID remapping, and conflict resolution — is a genuine minefield
that deserves its own change rather than being smuggled in here.

## What Changes

- **Local data cache (read-only):** cache the entities each store loads —
  owned + friend **tours**, **contacts**, **user profile**, **calendar
  availability**, **friendships** — in a hand-rolled IndexedDB store (same
  primitive as the offline-map region ledger, `src/features/map/data/services/
  offline-region-store.ts`; no new dependency). Cached values are last-known-good
  domain entities, keyed per collection and per user.
- **Hydrate-then-refetch load path:** on `loadX()`, a store reads the cache first
  and paints instantly, then (if online) refetches from Supabase and **overwrites**
  both the store refs and the cache. Offline, the cached snapshot is the answer and
  no network call is made. Overwrite-on-refetch is server-authoritative — the
  degenerate case of the row-level last-write-wins stance recorded for the future
  write slice.
- **Online/offline detection:** a single reactive `isOnline` signal
  (`navigator.onLine` + `online`/`offline` events), a module-level singleton like
  the realtime `pageVisible` ref. Stores consult it to skip the network offline;
  the UI consults it to surface state.
- **Reconnect reconciliation reuses realtime:** no new sync engine. When the
  device comes back online the Realtime channels re-subscribe and their existing
  `onSubscribed` refetch fires (see `.claude/architecture.md` → Realtime), which
  runs the same hydrate-then-refetch path and overwrites the cache. The offline
  cache is simply the read fallback while that path is unavailable.
- **Block writes while offline:** the ~20 mutation store actions (create/update/
  delete tour, edit contact, edit profile, edit availability, friend actions) route
  through a single thin `mutate(fn)` wrapper that, when `isOnline` is false, shows a
  localized "unavailable offline" notice and returns without touching state. One
  seam every caller passes through — not a guard copied into 20 actions — because
  offline-write-sync converts exactly this wrapper's offline branch from drop→enqueue. A
  global offline indicator surfaces the state to the user.
- **Architecture doc:** the PWA section's "no offline data **sync**" line is
  qualified — read caching now exists; write sync is the next slice.

## Capabilities

### New Capabilities
- `offline-data-cache`: read-only offline cache of the store-loaded domain
  collections (tours, contacts, profile, calendar, friendships) with a
  hydrate-then-refetch load path, an online/offline signal, reconnect
  reconciliation via the existing realtime refetch, and offline write-blocking.

### Modified Capabilities
<!-- none — pwa-support is untouched; offline data caching and the online/offline
     signal are new behavior owned entirely by the new offline-data-cache
     capability. -->

## Impact

- **New core code (`src/core/offline/`):**
  - `entity-cache.ts` — hand-rolled IndexedDB key→value store (own DB
    `tourenbuddy-data-cache`, one object store keyed by `<collection>:<uid>`),
    mirroring `offline-region-store.ts`. `get`/`put`/`clear`.
  - `cached-load.ts` — the generic hydrate-then-refetch helper the stores call:
    read cache → paint → (online) refetch → overwrite store + cache.
  - `use-online-status.ts` (composable) — module-singleton reactive `isOnline`.
  - `mutate.ts` — thin `mutate(fn)` write seam: offline → snackbar + return; online
    → run `fn`. The single point offline-write-sync later turns into an enqueue.
- **Stores (`features/*/presentation/stores/`):** `tours-store`, `contacts-store`,
  `user-profile-store`, `availability-store`, `friendships-store` — route their
  `loadX()` through `cached-load` and wrap their mutation actions in `mutate()`.
  Small, uniform edits; no repository-interface changes.
- **UI:** a global offline indicator (banner/pill) + localized "unavailable
  offline" snackbar on blocked mutations. i18n keys in `en.json` + `de-CH.json`.
- **Docs:** `.claude/architecture.md` PWA section — qualify the "no offline data
  sync" line.
- **No DB / migration changes. No Worker changes. No new npm dependency.**
- **Explicitly deferred to offline-write-sync:** offline write queue,
  temp-ID → server-UUID remapping, and last-write-wins conflict resolution on
  replay. This change records those decisions in design.md but builds none of them
  (read-only ⇒ no client writes ⇒ no conflicts to resolve).
