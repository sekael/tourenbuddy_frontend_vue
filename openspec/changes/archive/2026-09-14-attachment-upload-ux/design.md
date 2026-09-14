## Context

### The writers of `attachmentsByTour`

| caller | trigger | file |
|---|---|---|
| strip `onMounted` | info sheet opens / re-opens | `tour-attachments-strip.vue:22-28` |
| realtime `onChange` (150 ms debounce) + `onSubscribed` | insert/update/delete, (re-)subscribe | `tour-attachments-store.ts:61-72` |
| form edit-mode watch | edit sheet opens, only when key absent | `tour-form.vue:243-249` |
| `add()` / `commitStaged()` / `remove()` / `reorder()` | user write, optimistic | `tour-attachments-store.ts:150-260` |

The first three all end in `load()`, one unconditional assignment:

```ts
await cachedLoad(`attachments:${tourId}`, () => repository.list(tourId),
  (result) => { attachmentsByTour.value[tourId] = result })
```

Nothing orders a `list()` in flight against an `insert` that completes after it was issued.
PostgREST answers the snapshot it saw, so the last writer wins by arrival time, not by
recency of data — and on a slow mobile link the `list()` is the slow one.

This rules out the obvious fix: refetching harder cannot help. The strip already refetches on
every mount (the comment at `:22-27` explains why), and the problem is that a result
*arrives* too late, not that reads are too rare.

### Three upload call sites, one transport, no progress

| path | uploads via | when |
|---|---|---|
| edit-flow `add()` | `repository.add` → `supabase.storage.upload` | on pick |
| create-flow `commitStaged()` | same | **after** the tour insert, `map-page.vue:766` |
| suggest-mode | `tour-suggestions-repository-impl.ts:140` `uploadStaged` | on submit |

`FileOptions` carries `contentType`, `upsert`, `cacheControl`, `duplex` — no `signal`, no
progress callback. `fetch()` has no upload-progress event either (only `ReadableStream`
request bodies, unsupported on Safari). Both reporter requirements — a real abort and a real
percentage — therefore need `XMLHttpRequest`, hence a URL we can PUT to without the SDK:
`createSignedUploadUrl()`.

### Reads are online-first, which is the "slow" half

`loadCachedBlob` (`blob-cache.ts:55-80`) when online *always* `fetchFresh()`es (signed URL +
full download) and only falls back to the cache on failure. Every info-sheet open therefore
re-downloads every attachment's bytes that IndexedDB already holds, and a flaky-but-online
link stalls on that fetch first. The online-first order was chosen for GPX, whose key
`<uid>/<tourId>.gpx` is genuinely upserted — it is wrong for attachments, whose keys are not.

### GPX prior art

The GPX flow already implements the shape the reporter asked for: pre-mint a `tourId`,
upload on pick before any row exists (`tour-form.vue:437-441`), disable Save while in flight
(`:1025`), delete the object if the user cancels or replaces (`:366-372`, `:461-473`). What it
lacks is progress and cancel. Attachments lack all of it. Both converge on one helper.

## Goals / Non-Goals

**Goals**

- A completed write can never be un-displayed by a slower in-flight read.
- Per-file determinate progress, per-file cancel, per-file retry — attachments and GPX.
- A picked file renders from local bytes; a viewed attachment never re-downloads.
- The 5-file cap counts in-flight files, and cap messages come from fresh data.
- Distinct filenames without discarding meaningful ones.

**Non-Goals**

- Multi-shot camera capture (no browser API; reporter agreed).
- Offline attachment *upload*. Stays online-only (DC10). Offline *viewing* is unaffected and
  gets faster (D2).
- Bulk prefetch of attachment bytes for offline viewing (bandwidth policy, separate change).
- HEIC support, resumable/chunked uploads, client-side image compression.
- Any schema, RLS, trigger or RPC change.

## Decisions

### D1 — Discard stale reads with a write sequence, kept local to this store

`writeSeq = ref(0)`, incremented after every successful `add` (per file), `commitStaged`,
`remove` and `reorder`. `load()` reads it before the fetch and applies only if unchanged:

```ts
const seq = writeSeq.value
await cachedLoad(key, () => repository.list(tourId), (result) => {
  if (seq !== writeSeq.value) return   // a write landed while we were reading — it wins
  attachmentsByTour.value[tourId] = result
})
```

The guard goes **inside** the assign callback, not around the `await`: `cachedLoad` also
paints from cache on a cold load, and that paint must survive.

Prior art: `tours-store.ts:199-205` guards `friendTours` with exactly this captured-sequence
compare (there against concurrent *loads*).

**Why a counter, not a "skip refetch while uploading" flag:** the race is not upload-specific.
`remove()` has the same shape (a delete lands, an earlier `list()` resolves and resurrects the
row), as does an accepted suggestion. One guard covers every writer, needs no teardown, and
cannot get stuck the way an in-flight boolean can when an upload throws.

**Why not merge server list + pending items:** merging needs a per-item identity decision for
every collection state (deleted-on-server vs. not-yet-inserted) — a CRDT for five files.

**Why not generic in `cachedLoad`:** six other stores call it (tours, contacts, availability,
profile, friendships, notifications), and their writes route through `mutate()`'s queue form,
where ordering is owned by the outbox and `flushThenRefetch` (DC4). A global counter in
`cachedLoad` would silently change reconciliation for all six inside a one-issue bugfix. Lift
it only when a second store actually needs it.

**Ceiling (ponytail):** a discarded read is not retried. Acceptable — a write just succeeded,
so the optimistic state *is* the fresh state, and the next `onChange` / `onSubscribed` / strip
mount reconciles.

### D2 — `preferCache` reads for attachments: a hit means no network

`loadCachedBlob(key, fetchFresh, { preferCache })`. With the flag, a cached blob is returned
immediately and **no request is made**; a miss behaves exactly as today. Attachment call sites
pass it; GPX does not.

Justified by immutability, not by staleness tolerance: attachment paths are
`<uid>/<tourId>/<uuid>.<ext>`, `repository.add` never upserts, and an "edit" is a delete plus
a fresh uuid. So a hit is byte-identical to the server by construction. This must be stated as
a comment in the helper — the day someone adds an upsert on an attachment path, that comment
is what tells them it breaks the read path too.

Consequences, all wanted: the picked file renders from the bytes we cache at pick time (below);
re-opening a tour costs no bandwidth; offline viewing skips a doomed fetch attempt.

GPX deliberately keeps online-first — `<uid>/<tourId>.gpx` is upserted on replace, so a stale
hit there would render the previous track.

### D3 — `uploadWithProgress()` in `core/utils/storage-upload.ts`

```ts
export async function uploadWithProgress(
  bucket: string, path: string, file: Blob,
  opts: { contentType?: string, upsert?: boolean, signal?: AbortSignal,
          onProgress?: (fraction: number) => void },
): Promise<void>
```

1. `createSignedUploadUrl(path, { upsert })` → `{ signedUrl }` (token in the query string, so
   no auth header to manage).
2. `XMLHttpRequest` `PUT` to it, `Content-Type` = `contentType`, `x-upsert: true` when
   upserting.
3. `xhr.upload.onprogress` → `onProgress(e.loaded / e.total)` when `lengthComputable`.
4. `signal` abort → `xhr.abort()`, reject with an `AbortError` `DOMException` so callers can
   tell a cancel from a failure. Non-2xx → reject with status + response text.

In `core/utils/` because a service (GPX), a repository (attachments) and another repository
(suggestions) all use it, and `core/` may not depend on features.

**Verify during implementation:** whether a signed upload URL upserts an *existing* object. If
not, GPX keeps `supabase.storage.upload()` and its indeterminate spinner; attachments (always
a fresh uuid key) are unaffected. GPX progress is the nice-to-have — it must not block the bug
fix.

**Ceiling (ponytail):** one PUT per file, no chunking or resume. A dropped connection restarts
that file (via Retry, D6). Fine at a 10 MB cap.

### D4 — Pending uploads are store state

```ts
interface PendingUpload {
  id: string             // the minted attachment id — same key the real row will have
  tourId: string         // real id (edit) or pre-minted id (create, D5)
  filename: string       // post-dedupe (D8)
  storagePath: string
  progress: number       // 0..1
  status: 'uploading' | 'failed'
  cancel: () => void     // AbortController.abort
}
const pendingByTour = ref<Record<string, PendingUpload[]>>({})
const uploading = computed(() => Object.values(pendingByTour.value)
  .some(l => l.some(p => p.status === 'uploading')))
```

In the store because three surfaces read it: the picker renders rows, the strip renders rows
for a create-flow batch, and `tour-form.vue` gates Save on `uploading`. Component-local state
would leave the form blind and would drop the rows when the sheet unmounts mid-upload — while
the request continues, since an attachment row does not depend on the tour save.

`status: 'failed'` is excluded from `uploading`: a failed row is settled, so it must not block
Save (D6), or a hard failure dead-ends the form the same way a hang would.

**Pending entries are NOT folded into the `attachments` list.** They have no row: they cannot
be reordered (the RPC takes real ids), cannot be `repository.remove`d, and would need
excluding from the drag handler, the delete confirm, and the suggest-mode removal diff. Three
exclusions to save two additions. They ARE counted for the cap (D7).

### D5 — Create flow pre-uploads to a pre-minted `tourId`, like GPX

Attachment *rows* need a `tour_id` FK, so today files sit in `stagedByDraft` and upload after
the insert — the slow part happens after Save, ungated and unshown (`map-page.vue:766`).
Storage writes need no row (RLS is path-based on `<owner>/…`), and the form already pre-mints
a `tourId` for GPX. So: pick → upload immediately to `<uid>/<preMintedTourId>/<uuid>.<ext>`,
Save waits for it exactly as it waits for GPX, and `commitStaged` becomes row-inserts only.

- Cancel / abandon / replace → best-effort `storage.remove` + `evictCachedBlob`, the teardown
  GPX already carries.
- No attachment row is ever created for an abandoned draft (rows only after the tour insert),
  so the existing create-flow guarantee holds unchanged.
- Orphaned *objects* are possible if the app is killed mid-form — a risk this form already
  accepts for GPX.
- `stagedByDraft` stays: it is still the structure for suggest-mode staging.

### D6 — Per-file settle, with Retry from cached bytes

Files upload independently — no `Promise.all` over the batch, since one failure must not
abort its siblings. Outcomes per file:

- **success** → pending entry removed, row appended, `writeSeq++`.
- **cancel** (`AbortError`) → entry removed, blob evicted, best-effort `storage.remove` in
  case the object landed anyway. No error banner, no error-level log. Siblings untouched, no
  form field reset, and when the last uploading entry clears, Save re-enables.
- **failure** → entry stays with `status: 'failed'`, offering **Retry** and **Dismiss**.
  Retry re-uploads from the blob cache — the bytes are already there for D2's sake, so this
  needs no re-pick (which on iOS would mean re-capturing a *different* photo). Dismiss evicts
  and drops the row. This is also what `gpx-tracks` already promises ("offers retry without
  losing other unsaved form data").

Going offline mid-upload is just a failure: Retry is disabled while `isOnline` is false and
enabled the moment it flips back. Deliberately **not** auto-retried on reconnect — that would
be an outbox for attachments in all but name (durable intent + automatic replay), which DC10
declined, and to be honest about surviving a reload it would need the `pending-upload:`
marker, quota accounting, and a replay handler. The offline banner already explains the dim
button.

Save gating: `:disabled="isUploadingGpx || attachmentsStore.uploading || attachmentOverflow > 0"`
plus the same check inside `handleSubmit()` (`tour-form.vue:526-531`), because the top-bar
Save button bypasses the attribute.

### D7 — The cap counts pending files; cap errors are recomputed, never echoed

`validateBatch(files, persisted + pending + baseCount)` and the picker's add-button gate
likewise. Without this, picking 3 and then 3 more while the first batch is in flight passes
both checks and hits the server trigger — a second route to the same confusing error, which
every other part of this change would leave intact.

On rejection: if the message contains `tour_attachment_limit_exceeded`, `await load(tourId)`
and then render `t('tours.attachments.limitRemaining', { remaining, selected })` from the
refreshed count. Any other repository error renders a generic i18n `uploadFailed`;
`err.message` is logged, never displayed. A database exception is a developer artefact, and —
as the issue shows — the number inside it is meaningless when the local count was wrong.

### D8 — Collision-driven numbering

Before upload, de-duplicate the picked name against every name the tour holds — persisted,
staged, and pending:

```
image.jpg, image.jpg, image.jpg  →  image.jpg, image1.jpg, image2.jpg
Hoernli.jpg                      →  Hoernli.jpg   (untouched)
```

Suffix the base, preserve the extension, increment until free. In the store, because only the
store sees all three lists — and doing it at pick time means the name shown while uploading is
the name that persists.

## Risks / Trade-offs

- **`createSignedUploadUrl` + XHR replaces a well-trodden SDK call.** One helper, one
  auth-header-free URL, tests on the abort/progress/error branches, and a documented GPX
  fallback (D3).
- **`preferCache` trades a theoretical stale read for the re-download.** Sound only while
  attachment paths stay immutable; the helper says so, and GPX is explicitly excluded.
- **A discarded stale read could hide a legitimate concurrent server change** (e.g. a
  partner's accepted suggestion) for one request. The next `onChange` / `onSubscribed`
  corrects it.
- **Pre-upload in create flow can orphan storage objects** if the app is killed mid-form.
  Already true for GPX; no orphan rows, and cleanup runs on every user-visible exit.
- **Save gating can read as a freeze** on a very slow link. Exactly why per-file Cancel and
  Retry are in this change, not a follow-up.

## Migration Plan

Pure client change: no DB step, no Worker deploy, no env var. Ships in one PR. Nothing to
backfill — existing rows keep their filenames, de-duplication applies to new picks only.
`preferCache` is opt-in, so no other blob consumer changes behaviour.

## Open Questions

- None blocking. The one unknown (upsert via signed upload URL, D3) affects only the GPX
  progress bar and has a stated fallback.
