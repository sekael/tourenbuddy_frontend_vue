## 0. Prerequisites (not tasks — gates)

Two changes MUST land before this one is applied:
- **offline-app-cache-sync** — merged **and archived**, so the `offline-data-cache`
  capability exists in `openspec/specs/` (this change's MODIFY targets it) and the
  `core/offline/{mutate,cached-load,entity-cache,use-online-status}.ts` seams exist
  in `src/`.
- **atomic-tour-write-rpcs** (separate prerequisite PR) — `create_tour_full` and
  `update_tour_full` stay **separate** (not merged into one upsert): create becomes
  idempotent via `INSERT … ON CONFLICT (id) DO NOTHING`; update stays **update-only**
  (0 rows if the row is gone → never resurrects). Both take an optional `p_visibility`
  and receive the GPX filepath directly, so `createTourFromDraft`/`updateTour` become
  a single idempotent RPC (+ best-effort GPX). The standalone `setVisibility` toggle
  is kept. Replay (task 7.1) depends on this being in place.

This change never edits either prerequisite's change folder; it references them only
via the durable capability spec and code paths.

## 1. Git Setup

- [x] 1.1 Cut a fresh branch from latest main (after offline-app-cache-sync is merged + archived): `git fetch origin && git checkout main && git pull && git checkout -b feat/245-offline-write-sync`

## 2. Durable write queue (`src/core/offline/`)

- [x] 2.1 `write-queue.ts` — add object store `write-queue` to the existing `tourenbuddy-data-cache` DB (bump `DB_VERSION`, create store in `onupgradeneeded`), keyed by `entityId` (ONE entry per entity). Entry `{ entityId, kind, op, payload, blobs?, baseSnapshot?, baseUpdatedAt?, seq, attempts }` where `op ∈ {create,update,delete}`, blobs as native `Blob`. Ops: `getEntry(entityId)`, `peekAllOrdered()` (by `seq`), `remove(entityId)`, `bumpAttempt(entityId)`, `deadLetter(entityId)` + a `dead-letter` store
- [x] 2.2 `coalesce(existing, incoming)` — pure fn implementing the DC1 table: create+update→`op=create` (merged payload); create+delete→ANNIHILATE (return null); update+update→`op=update` keeping FIRST `baseSnapshot`/`baseUpdatedAt`; update+delete→`op=delete`; delete terminal. **This is the core logic gap — write it test-first**
- [x] 2.3 Enqueue quota guard: before enqueue, `navigator.storage.estimate()` headroom check (same pattern as offline-map-support/offline-app-cache-sync); if short, refuse with a clear message rather than corrupt the queue

## 3. `mutate()` becomes an enqueue seam (`src/core/offline/mutate.ts`)

- [~] 3.1 Grow the seam to `mutate({ run, optimistic, intent })`: online → `run()` (unchanged from offline-app-cache-sync); offline → in ONE IndexedDB transaction across the cache + queue stores (DC2 atomicity): capture `baseSnapshot` from cache if the net `op` is `update`, `coalesce()` (2.2) the incoming intent with any existing entry for the entity, write-through the entity cache, then update the ref AFTER commit + toast "saved offline, will sync". Return a discriminated result (applied-online vs queued). `discard(entityId)` uses the same one-txn pattern to remove the entry + restore cache from `baseSnapshot` (or drop the entity) + repaint the ref immediately

## 4. Replay (`src/core/offline/replay.ts`)

- [x] 4.1 `kind → handler` registry (`registerReplay(kind, handler)`), populated by stores at init. Handler replays by `entry.op`: `create` → `create_tour_full` (ON CONFLICT DO NOTHING) + best-effort GPX; `update` → `update_tour_full` (update-only; 0-rows/404 → dead-letter, never resurrect); `delete` → delete; then deferred notify keyed on `entry.op`
- [x] 4.2 `replayQueue()` — drain `peekAllOrdered()` (by `seq`, cross-entity FK order): dispatch each entry; success → `remove(entityId)`; transient failure → `bumpAttempt` + capped backoff; permanent failure (4xx/404/LWW-loser/over-cap) → `deadLetter` and continue (no head-of-line block)
- [x] 4.3 Cross-entity dependency cascade: when a create for entity A dead-letters, dead-letter any pending entry whose `payload` references A (e.g. a tour whose `partnerIds` include a contact created offline that failed)
- [x] 4.4 Expose a `replayDone` gate (single-flight `replayQueue()` promise) (promise resolving when a drain completes) for the reconnect-ordering wiring (task 6)

## 5. Reachability + flush trigger (`src/core/offline/use-reachability.ts`)

- [x] 5.1 Reachability PREDICATE — covered by the existing `use-online-status.ts` (navigator.onLine + backed-off HEAD probe + cold-boot `confirmConnectivity`), not rebuilt (`isOnline` is the single write-gate signal). WS-SUBSCRIBED is the authoritative flush trigger (5.2 / task 6.1); the HEAD probe is the last-resort tier already, with no fixed polling loop while online.
- [x] 5.2 Flush TRIGGERS — `flush-triggers.ts` `registerFlushTriggers()` (wired in App.vue onMounted): kickstart `replayQueue()` on the offline→online transition and on foreground (`visibilitychange`→visible while reachable). Authoritative SUBSCRIBED trigger is reconnect.ts (6.1); DC9 backed-off retry is in replay.ts. Single-flight so overlapping nudges join one drain.

## 6. Reconnect ordering — flush before refetch

- [~] 6.1 The `onSubscribed` transition kickstarts `replayQueue()` (task 5.2) AND gates the refetch: each in-scope store's `onSubscribed` refetch `await`s `replayDone` before assigning, so the drain completes before the overwrite — one event, closing the offline-app-cache-sync D6 clobber hazard. Shared seam `core/offline/reconnect.ts` `flushThenRefetch(refetch)` (single-flight drain, then refetch; failed flush still refetches). Wired in tours-store; contacts/profile/availability/friendships wire it as they land (7.2–7.5)

## 7. Wire the stores (`features/*/presentation/stores/`)

- [x] 7.1 Tours — `createTourFromDraft` / `updateTour` / `deleteTour` / `setCompleted` / `setVisibility`: supply `mutate()` the `{ run, optimistic, intent }` triple; register the replay handler (dispatches by `entry.op` to the separate create/update/delete calls from the atomic-tour-write-rpcs prerequisite) + best-effort GPX — NO multi-write replay. Move inline `notifyTourChanged` etc. into the shared success path both `run` and the replay handler call (deferred dispatch). For `updateTour`/`setVisibility`/`deleteTour`, capture `snapshotTourGroupContext(id)` at enqueue into `entry.linkSnapshot` and run `dispatchEvictionIfHappened(entry.linkSnapshot, id)` in the replay handler AFTER the write (deferred eviction dispatch, DC6) — best-effort
  - DONE: create/update/delete + notify seam + eviction + LWW wired. `setCompleted`/`setVisibility` unified as `update` ops (Path Y) — build a draft from the current tour + delegate to `updateTour`; folded `p_completed` into `create_tour_full`/`update_tour_full` (migration `20260811093000`) so a completion flip replays as one idempotent RPC; seam notifies on a completion flip (excluded from `isMeaningfulTourChange`). Dead `patchCompleted`/`patchVisibility` removed.
  - DONE: offline-GPX-blob. Picking a GPX offline mints its storage key client-side (`gpxStorageKey`), stages the blob (`cacheBlob` under `blob:<key>`, rendered offline by the existing `loadCachedBlob` path) + a `pending-upload:<key>` mark; the store rides the blob on `entry.blobs` (gated on the mark, so a display-cached blob isn't re-queued) with `projectedBytes` for the quota guard; replay uploads via `uploadGpxToKey` before the row write (after the LWW gate on update, so a loser doesn't orphan), then clears the mark. Attachments remain online-only (DC10).
- [x] 7.2 Contacts — add/update/delete + method actions: same triple + replay handlers
  - DONE (full parity): every contact-field AND method action (add/update/remove/setPrimary) builds the whole desired Contact aggregate and routes through one `updateContactAggregate` (contacts' "Path Y", mirroring `setCompleted→updateTour`); create via `createContactAggregate`. New idempotent aggregate RPCs `create_contact_full` / `update_contact_full` (migration `20260811100000`) reconcile the whole method set in one call (client-minted ids for contact AND methods, DC0) — so a coalesced "create + N method edits + rename" replays as ONE call (no multi-write replay). `update_contact_full` is update-only (returns false when gone → dead-letter, never resurrect). LWW via `getContactUpdatedAt` vs `baseUpdatedAt` (DC5); `updated_at` already on both tables (`20260811085649`). Replay handler `kind='contact'` + `onSubscribed: flushThenRefetch(loadContacts)` (DC4). Contacts dispatch no notifications, so no deferred-notify seam. ONLINE and OFFLINE now share ONE path: the online branch runs the same `*_full` RPCs the replay handler does (no more RLS-table `.update()` for fields + separate per-method writes) — the split edit path existed only because single-table edits were RLS-authorizable without a `security definer` function; the aggregate replay requirement (client-minted ids, whole-set reconcile) forces the RPC, so online rides it too and pays the hand-rolled owner gate the old RLS path avoided. Delete stays plain `supabase.from('contacts').delete()` + RLS + FK cascade — matching tours (`deleteTour`), which is also NOT an RPC; no `delete_contact` RPC. Dead-code cleanup DONE: `ContactMethodsRepositoryImpl` + interface deleted (`NewContactMethod` type kept — still used by store + `contact-detail-view`), legacy `create_contact_with_methods` + `set_primary_phone` RPCs dropped via `20260813000000_drop_legacy_contact_method_rpcs.sql` (function-only drop, no row touched), stale `vi.mock` blocks + the impl test removed.
- [ ] 7.3 Profile — `updateProfile` / `deletePhone` / `setLocale`: same
- [ ] 7.4 Availability — `save`: same
- [ ] 7.5 Friendships — friend-request send / `accept` / `deny`: same, with deferred `notifyFriendRequest*`. Confirm idempotency against the friendship uniqueness constraint so a double-sent request on replay is safe. Friend TOURS remain read-only — no handler, no queue
- [ ] 7.6 Conflict handling (LWW governs `op=update` only): replay compares server `updated_at` vs entry `baseUpdatedAt` (DC5(i)); server-newer → skip + surface. `op=delete` replays unconditionally. `op=update` on a server-deleted row → dead-letter, never resurrect (guaranteed by update-only `update_tour_full`). If any in-scope table lacks a reliable `updated_at`, add it via a local-first migration (DC5(ii)) — `supabase migration new <name>`, `supabase db reset` to verify; prompt before `db push`

## 8. UI

- [ ] 8.1 Pending-sync indicator (queued count) + "saved offline" toast on enqueue. DURABLE — reads the queue on every launch (even offline) so unsynced work is always visible, not a transient toast (DC7 replay-trigger ceiling). Do NOT add an app-close warning (no reliable mobile close event)
- [ ] 8.2 Dead-letter review surface: list failed writes with retry (re-attempt the same entry) / discard (immediate per-entity revert via `discard(entityId)`, 3.1)
- [ ] 8.2a Attachment upload UI (DC10): while offline, visibly disable the add/upload control and show an "attachments available online only" hint — distinct from the general saved-offline behavior. Reading existing attachments unaffected
- [ ] 8.3 i18n keys in `en.json` + `de-CH.json` (`offlineSync.savedOffline`, `offlineSync.pendingCount`, `offlineSync.conflictLost`, `offlineSync.deadLetter.*`, `offlineSync.attachmentsOnlineOnly`) — EVERY locale

## 9. Docs

- [ ] 9.1 `.claude/architecture.md` PWA section — REMOVE the "no offline data **sync**" line (read cache + write sync now both exist). Keep the offline base-map tile note from offline-map-support

## 10. Tests (edge cases + failures only)

- [ ] 10.1 `coalesce()` (2.2): create+update→one `op=create` entry; create+delete→null (annihilate); update+update→keeps FIRST `baseSnapshot`/`baseUpdatedAt`; update+delete→`op=delete`. Blob round-trips; one entry per entity across reopen
- [ ] 10.1a Atomicity: a simulated failure between the cache write and the queue write leaves BOTH unchanged (single-txn) — no phantom-synced cache edit
- [ ] 10.2 `replayQueue`: entries drain in `seq` order; transient failure retries (no dead-letter); permanent failure dead-letters AND the queue keeps draining; a dead-lettered create cascades to a pending entry referencing it
- [ ] 10.2a Discard: `discard(entityId)` on an offline edit immediately restores `baseSnapshot` (no refetch); on an offline-created entity removes it entirely; entry gone
- [ ] 10.3 Deferred notify: an offline mutation dispatches ZERO notifications until replay succeeds, then exactly one keyed on `op` (create-then-edit → "created", not "updated"); annihilated create+delete dispatches none (mock notify-dispatch)
- [ ] 10.4 Reconnect ordering: a store's `onSubscribed` refetch does not assign until `replayDone` resolves (assert flush-before-overwrite)
- [ ] 10.5 Conflict: `op=update` server-newer `updated_at` → skipped + surfaced; server-not-newer → applied; `op=delete` → applied unconditionally; `op=update` on a server-deleted row → dead-lettered, NOT resurrected
- [ ] 10.6 Reachability: no health `HEAD` is issued while the queue is empty; WS-connected + non-empty queue triggers a flush without a polling loop
- [ ] 10.7 `npm run test` — all pass

## 11. Finalize

- [ ] 11.1 `npx eslint . --fix` — zero warnings
- [ ] 11.2 `npm run type-check` — clean
- [ ] 11.3 If a migration was added (7.6): prompt user to `supabase db push` (do NOT run unprompted); confirm applied to prod before the frontend deploy relies on it
- [ ] 11.4 Prompt user to commit (do NOT commit) with message: `feat(offline): queued offline writes with reconnect replay (#245)`
- [ ] 11.5 Prompt user to push the branch and open a PR to `main`
