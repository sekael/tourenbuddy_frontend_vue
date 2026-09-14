## Why

Issue #285: uploading photos to a tour from the mobile PWA is slow and, on a bad link,
loses the list. Four separate defects hide behind one report.

**1. A stale refetch overwrites the just-uploaded list.** `load()`
(`tour-attachments-store.ts:88-110`) assigns `attachmentsByTour[tourId] = result`
unconditionally. Three callers fire it on their own schedule: the strip's `onMounted`
(`tour-attachments-strip.vue:22-28`), realtime `onChange`/`onSubscribed` (`:69-72`), and the
form's edit-mode watch (`tour-form.vue:247`). `add()` uploads on pick and is gated by
nothing, so on a slow connection:

```
strip mounts → list() request in flight (server still has 0 rows)
  add() → 4 uploads + 4 inserts complete
    list() resolves with the 0-row snapshot → assigns [] over the 4 fresh rows
```

The tour then shows no attachments although five were uploaded, and nothing recovers it: the
realtime insert events already fired, and `onSubscribed` will not fire again while the
channel stays up. It is a lost-update race, not a caching bug — `cachedLoad` faithfully
applies what the repository returned.

**2. The follow-up error is the raw Postgres exception.** With the local list back at `[]`,
`validateBatch` (`:113-140`) sees count 0 and passes the re-added 4 files. The trigger
`check_tour_attachment_limit` (`20260524033946_tour_attachments.sql:46-63`) raises, `add()`
stores `err.message` verbatim, and the picker shows
`tour_attachment_limit_exceeded: a tour may have at most 5 attachments` — the issue's second
screenshot. There is a second, independent route to the same error: neither `validateBatch`
nor the picker's add-button gate counts files that are *currently uploading*, so picking 3
and then 3 more while the first batch is in flight sends 6 files at a 5-file cap.

**3. Nothing is visible immediately, nothing can be cancelled, and every open re-downloads.**
`repository.add` uses `supabase.storage.upload()`, which exposes neither progress nor abort,
so the user gets one indeterminate spinner (`tour-attachments-picker.vue:171`) for a whole
batch and no way out — while Save happily submits mid-upload. Worse, `loadCachedBlob`
(`blob-cache.ts:55-80`) is **online-first**: when online it always fetches through a signed
URL and only falls back to the cache on failure. So every info-sheet open re-downloads every
attachment's full bytes even though IndexedDB already holds them, and a nominally-online but
flaky link stalls on that fetch before falling back. That is the "slow" half of the title.

**4. Every camera photo is named `image.jpg`.** The row stores `file.name`
(`tour-attachment-repository-impl.ts:57`) and iOS/Android hand the same generic name to every
capture, so the list reads `image.jpg` five times.

## What Changes

- **A stale `list()` result can no longer be applied.** The store gets a monotonic
  `writeSeq`, bumped by every successful add/remove/reorder. `load()` captures it before the
  fetch and discards the result if it changed while in flight (design D1) — the same
  captured-sequence guard `tours-store.ts:199-205` already uses for `friendTours`.
- **Attachment bytes are read cache-first.** `loadCachedBlob` gains an opt-in `preferCache`
  flag: a hit paints with **no network request at all** (design D2). Attachment storage paths
  are content-immutable — a new upload always mints a new uuid, nothing upserts them — so a
  hit cannot be stale. This fixes the per-open re-download, makes a picked file visible
  instantly, and makes offline viewing faster. GPX keeps online-first: its key
  (`<uid>/<tourId>.gpx`) **is** upserted.
- **Uploads run per file with real progress and real cancel.** New shared
  `core/utils/storage-upload.ts` — `uploadWithProgress()` uses `createSignedUploadUrl()` +
  `XMLHttpRequest` PUT, so it reports bytes sent and `xhr.abort()` tears the socket down for
  real (design D3). Not achievable with `supabase.storage.upload()` (no `AbortSignal`, no
  progress) or `fetch()` (no upload-progress event). All three upload call sites — edit-flow
  `add()`, create-flow, and the suggestion staging upload
  (`tour-suggestions-repository-impl.ts:140`) — route through it, so one transport exists.
- **The picker and the strip show one row per file** with a determinate `<progress>` and a
  Cancel button, driven by store-level pending state (design D4). Cancelling aborts that
  file only: siblings continue, persisted attachments stay, no form field is reset, and Save
  re-enables — the escape hatch that makes gating Save safe on a hanging connection.
- **Save is blocked while any upload is in flight**, for attachments as well as GPX, and the
  guard is repeated inside `handleSubmit()` because the top-bar Save bypasses the attribute.
- **The create flow pre-uploads like GPX already does.** Files picked while creating a tour
  upload immediately to a pre-minted `tourId` path (`<uid>/<tourId>/<uuid>.<ext>`), so Save
  waits for them exactly as it waits for GPX and the post-insert work is row-inserts only
  (design D5). Today those bytes upload *after* Save with no gate and no feedback
  (`map-page.vue:766`). Storage RLS is path-based, so no row is needed to write the object;
  no attachment row is ever inserted for an abandoned draft.
- **A file that fails keeps its row, with Retry and Dismiss** (design D6). Retry re-uploads
  from the already-cached bytes — no re-pick, which on iOS would mean a *different* photo. A
  failed row is settled, so it does not block Save. Offline, Retry is disabled rather than
  queued: attachment upload stays online-only (DC10), and an auto-replaying queue would be an
  outbox in all but name.
- **The cap is never reported from stale data, and always counts pending uploads.** Both the
  client check and the add-button gate include in-flight files. A cap rejection (client or
  server) refetches the list first, then renders the i18n `limitRemaining` message from the
  fresh count. Raw database text never reaches the UI (design D7).
- **Duplicate filenames get numbered** — `image.jpg`, `image1.jpg`, `image2.jpg` — collision
  driven, so meaningful gallery names survive untouched (design D8).
- **GPX upload gets a determinate progress bar** by routing `uploadGpxToKey` through the same
  helper, replacing the indeterminate `gpx-spinner`.

## Impact

- Affected specs: `tour-attachments` (stale-read guard, cache-first reads, per-file
  progress/cancel/retry, pre-upload in create flow, cap accounting + error mapping, filename
  de-duplication), `gpx-tracks` (determinate upload progress)
- Affected code: `src/core/utils/storage-upload.ts` (new), `src/core/offline/blob-cache.ts`,
  `src/features/tours/data/repositories/tour-attachment-repository-impl.ts`,
  `src/features/tours/domain/repositories/tour-attachment-repository.ts`,
  `src/features/tours/data/repositories/tour-suggestions-repository-impl.ts`,
  `src/features/tours/presentation/stores/tour-attachments-store.ts`,
  `src/features/tours/presentation/components/tour-attachments-picker.vue`,
  `src/features/tours/presentation/components/tour-attachments-strip.vue`,
  `src/features/tours/presentation/components/tour-form.vue`,
  `src/features/map/presentation/pages/map-page.vue`,
  `src/features/tours/data/services/gpx-storage-service.ts`, `src/locales/{en,de-CH}.json`
- No database change: schema, RLS, the cap trigger and the reorder RPC are all unchanged.
- **Non-goal (decided with the reporter):** multi-shot camera capture. No browser API returns
  several captures from one `<input capture>` invocation; OS multi-select already covers the
  library case, and unique naming removes the symptom that made repeated single captures
  confusing.
- **Non-goal:** bulk prefetch of attachment bytes for offline viewing. Reads stay
  lazily-cached-on-view (DC10 keeps offline *reads* working); a partner's attachment never
  opened online still has no local bytes. Bandwidth policy, unrelated to this issue —
  separate proposal if wanted.
