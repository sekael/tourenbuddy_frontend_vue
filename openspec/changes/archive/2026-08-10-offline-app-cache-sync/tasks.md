## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/245-offline-app-cache-sync`

## 2. Core offline primitives (`src/core/offline/`)

- [x] 2.1 `entity-cache.ts` — hand-rolled IndexedDB key→value store in its own DB `tourenbuddy-data-cache`, one object store keyed by string, mirroring `features/map/data/services/offline-region-store.ts` (`openDb` / `promisify` / `withStore`). Expose `getCached<T>(key): Promise<T | undefined>`, `putCached(key, value)`, `clearCached(key)`. Store values as structured-cloneable JSON of domain entities. No new dependency
- [x] 2.2 `use-online-status.ts` — module-level singleton reactive `isOnline` seeded from `navigator.onLine`, updated by `window` `online`/`offline` listeners (added once at module init, same pattern as realtime `pageVisible`). Export the ref
- [x] 2.3 `cached-load.ts` — the generic hydrate-then-refetch helper. `cachedLoad<T>(key, fetcher, assign)`: read cache → if present `assign` it; if offline return; else `await fetcher()`, `assign` fresh, overwrite cache; on fetcher error while online, keep the cached snapshot and rethrow/record so the caller's `error` contract holds. Keyed per-uid by the caller
- [x] 2.4 `mutate.ts` — thin write seam `mutate(fn)`: `if (!isOnline) { snackbar('offline.actionUnavailable'); return }` else `return fn()`. This is the single seam offline-write-sync converts from drop→enqueue (design D5/D6) — keep it tiny and side-effect-free beyond the snackbar

## 3. Route store loads through the cache

- [x] 3.1 `tours-store` — `loadTours` and `loadFriendTours` delegate to `cachedLoad` with keys `tours:<uid>` / `friend-tours:<uid>`, assigning `tours.value` / `friendTours.value`. Preserve the `friendToursSeq` race guard and `isLoading` / `error` handling
- [x] 3.2 `contacts-store` — `loadContacts` through `cachedLoad` (`contacts:<uid>`)
- [x] 3.3 `user-profile-store` — profile load through `cachedLoad` (`profile:<uid>`)
- [x] 3.4 `availability-store` — availability load through `cachedLoad` (`availability:<uid>`)
- [x] 3.5 `friendships-store` — friendships load through `cachedLoad` (`friendships:<uid>`)
- [x] 3.6 Confirm reconnect path: each store's realtime `onSubscribed` already calls its `loadX()`, so reconnect overwrites the cache with no extra code (design D4). No new online-event refetch is added

## 4. Block writes while offline

- [x] 4.1 Wrap the body of every in-scope mutation action in `mutate()` (2.4): tours `createTourFromDraft` / `updateTour` / `deleteTour` / `setCompleted` / `setVisibility`; contacts add/update/delete + method actions; profile `updateProfile` / `deletePhone` / `setLocale`; availability `save`; friendships `accept` / `removeFriendship`. Offline → the wrapper shows the notice and returns; no state touched, nothing queued
- [x] 4.2 SCOPE GUARD (reviewer check): this PR builds read cache + online signal + `mutate()` block-seam and NOTHING else. Reject any write-queue, tombstone, temp-ID-remap, optimistic-cache-write, or conflict-resolution code — all of that is offline-write-sync (design D6). Friend tours stay read-only with no write path at all

## 5. UI

- [x] 5.1 Global offline indicator (banner or status pill) bound to `isOnline`, rendered at the app shell so every route surfaces offline state
- [x] 5.2 i18n keys in `en.json` + `de-CH.json` (`offline.indicator`, `offline.actionUnavailable`) — add to EVERY locale

## 6. Docs

- [x] 6.1 `.claude/architecture.md` PWA section — qualify the "no offline data **sync**" line: read caching now exists (this change); write sync is the next offline-write-sync. Leave the tile note from the map slice intact

## 7. Tests (edge cases + failures only)

- [x] 7.1 `cachedLoad`: offline path returns the cached snapshot and does NOT call the fetcher; online path overwrites cache after refetch; online fetcher error keeps the prior cached snapshot and surfaces the error (fetcher + cache stubbed) — **this is the core logic gap; written red first**
- [x] 7.2 `entity-cache`: reading a missing/never-written key resolves `undefined` (not throw); per-uid keys are isolated (writing `tours:a` does not affect `tours:b`)
- [x] 7.3 Store mutation guard: a mutation action invoked while `isOnline` is false does not call the repository and shows the offline notice (mock repository interface + `isOnline` false)
- [x] 7.4 `use-online-status`: an `offline` window event flips the singleton to false and `online` flips it back
- [x] 7.5 `npm run test` — all pass

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` — zero warnings
- [x] 8.2 `npm run type-check` — clean
- [x] 8.3 Prompt user to commit (do NOT commit) with message: `feat(offline): read-only offline data cache (#245)`
- [x] 8.4 Prompt user to push the branch and open a PR to `main`
