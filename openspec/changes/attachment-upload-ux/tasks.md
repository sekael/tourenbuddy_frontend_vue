## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/285-attachment-upload-ux`

## 2. Upload transport — **your gap**

- [x] 2.1 New `src/core/utils/storage-upload.ts` — implement `uploadWithProgress()` per design D3, marked with `// TODO(me):`. Signature `uploadWithProgress(bucket, path, file, { contentType?, upsert?, signal?, onProgress? }): Promise<void>`. `createSignedUploadUrl(path, { upsert })` for the URL, then `XMLHttpRequest` `PUT` — `fetch()` has no upload-progress event, which is the only reason this file exists. Must: report `e.loaded / e.total` only when `lengthComputable`; call `xhr.abort()` on `signal` abort and reject with an `AbortError` `DOMException` so callers can tell a cancel from a failure (a cancel must NOT reach the error banner); reject with status + response text on non-2xx; settle exactly once on every path, including a signal that is ALREADY aborted when passed in. No retry logic, no chunking — add a `ponytail:` comment naming that ceiling (one PUT per file, restart via Retry, fine at the 10 MB cap)

## 3. Kill the stale-read race (the actual bug, design D1)

- [x] 3.1 `src/features/tours/presentation/stores/tour-attachments-store.ts` — add `const writeSeq = ref(0)`. In `load()`, capture `const seq = writeSeq.value` before `cachedLoad` and make the apply callback `if (seq !== writeSeq.value) return` before assigning. Bump `writeSeq.value++` after each successful per-file add, `commitStaged`, `remove`, and `reorder`. Guard inside the callback, NOT around the `await` — `cachedLoad` also paints from cache on a cold load and that paint must stay. Mirror `tours-store.ts:199-205`, which already does this for `friendTours`
- [x] 3.2 Do NOT add a "skip refetch while uploading" flag, do NOT merge server + pending lists, and do NOT lift the counter into `cachedLoad` (design D1 records why each is worse — the last would change reconciliation for six other stores)

## 4. Cache-first attachment reads (design D2)

- [x] 4.1 `src/core/offline/blob-cache.ts` — `loadCachedBlob(key, fetchFresh, opts?: { preferCache?: boolean })`. With `preferCache`, return a cached blob immediately and issue NO request; miss behaves exactly as today. Comment the justification: attachment paths are immutable (`<uid>/<tourId>/<uuid>.<ext>`, never upserted), so a hit cannot be stale — and an upsert on an attachment path would break this read path
- [x] 4.2 `tour-attachments-store.ts` — `getViewUrl` passes `preferCache: true`. Do NOT touch the GPX read path: `<uid>/<tourId>.gpx` IS upserted on replace, so cache-first there would render the previous track

## 5. Client-minted ids + local-first bytes (design D2/D5)

- [x] 5.1 `src/features/tours/domain/repositories/tour-attachment-repository.ts` — `NewAttachmentInput` gains `id: string`, `signal?: AbortSignal`, `onProgress?: (f: number) => void`
- [x] 5.2 `src/features/tours/data/repositories/tour-attachment-repository-impl.ts` — drop the internal `uuidv4()` in `add()`, take `input.id`, upload via `uploadWithProgress`, keep the existing orphan cleanup on insert failure. Export `attachmentStoragePath(userId, tourId, id, mimeType)` so callers can mint the path before uploading. Split row insertion into a separate method (e.g. `insertRow`) — create-flow needs upload-now, insert-after-tour-exists (task 7)
- [x] 5.3 `tour-attachments-store.ts` — `cacheBlob(storagePath, file)` BEFORE starting each upload, so the picker/strip paint instantly via 4.2. On cancel / dismiss: `evictCachedBlob(storagePath)` + best-effort `supabase.storage.remove`. Do NOT call `markPendingUpload` — that marker means "upload on write-queue replay", and attachments have no replay handler (DC10); marking them would strand a phantom pending-upload key

## 6. Pending state, cancel, retry (design D4/D6)

- [x] 6.1 `tour-attachments-store.ts` — add `pendingByTour` (`{ id, tourId, filename, storagePath, progress, status: 'uploading' | 'failed', cancel }[]`) and `const uploading = computed(...)` counting only `status === 'uploading'`. Export both. A failed entry must NOT block Save (design D6) — that is the whole reason `status` exists rather than a bare list
- [x] 6.2 Rewrite `add(tourId, files)`: per file — mint id + path, dedupe the name (8.1), `cacheBlob`, push a pending entry with its own `AbortController`, `await repository.add` with `onProgress` writing back into the entry. Per-file settle: NO `Promise.all` over the batch, one failure must not abort siblings. Success → remove entry, append row, `writeSeq++`. `AbortError` → remove entry silently (no `error.value`, no error-level log). Other failure → `status = 'failed'`. Keep the surrounding `mutate()` block form and the offline gate (DC10) exactly as they are
- [x] 6.3 `tour-attachments-store.ts` — `retryUpload(id)` re-uploads from `peekCachedBlob(storagePath)` (no re-pick — on iOS a re-capture would be a different photo) and `dismissUpload(id)` evicts + drops the entry
- [x] 6.4 `src/features/tours/presentation/components/tour-attachments-picker.vue` — render one row per pending entry above the persisted list: filename, native `<progress>` (not a hand-rolled bar), Cancel while uploading, Retry + Dismiss when failed, Retry disabled while `!isOnline`. Replace the single indeterminate `.picker__spinner` (`:171`) with these rows
- [x] 6.5 `src/features/tours/presentation/components/tour-attachments-strip.vue` — render the same pending rows for the tour, so a create-flow batch shows progress in the tour's strip instead of nothing. Reuse a small shared child component with 6.4 rather than duplicating the markup
- [x] 6.6 `src/features/tours/presentation/components/tour-form.vue` — Save `:disabled="isUploadingGpx || attachmentsStore.uploading || attachmentOverflow > 0"` (`:1025`) plus the same `uploading` check inside `handleSubmit()` (`:526-531`), since the top-bar Save bypasses the attribute. Do NOT cancel uploads from `handleCancel()` in EDIT mode — an attachment row is independent of the tour save (design D5); create mode does clean up (task 7.3)

## 7. Create-flow pre-upload (design D5)

- [x] 7.1 `tour-form.vue` — in create mode, picked files upload immediately to `<uid>/<preMintedTourId>/<uuid>.<ext>` using the same pre-minted `tourId` the GPX flow already mints (`:437-441`). Follow that flow's structure, including the offline branch behaviour: attachments are online-only (DC10), so offline the picker stays disabled and nothing is staged
- [x] 7.2 `tour-attachments-store.ts` + `src/features/map/presentation/pages/map-page.vue:766` — `commitStaged` becomes row-inserts only for the already-uploaded files (no upload work). Rows still insert only AFTER the tour row exists (FK), so an abandoned draft can never leave rows
- [x] 7.3 `tour-form.vue` `handleCancel()` / file replace in create mode — best-effort `storage.remove` + `evictCachedBlob` for every pre-uploaded attachment object, mirroring the GPX teardown at `:366-372` and `:461-473`
- [x] 7.4 Keep `stagedByDraft` — it is still the suggest-mode staging structure. Do not delete it with the create-flow upload path

## 8. Filenames, cap accounting, error text

- [x] 8.1 `tour-attachments-store.ts` — de-duplicate a picked name against persisted + staged + pending names (design D8): keep the extension, append an incrementing number to the base ONLY on collision (`image.jpg` → `image1.jpg`). Apply in `stage()` too, so the name shown while uploading is the name persisted
- [x] 8.2 `tour-attachments-store.ts` + `tour-attachments-picker.vue:174` — the cap counts in-flight files: `validateBatch(files, persisted + pending + baseCount)` and the same for the add-button gate. Without this, 3 files picked while 3 are uploading passes both checks and hits the server trigger — a second route to the reported error (design D7)
- [x] 8.3 `tour-attachments-store.ts` — map failures per design D7: a message containing `tour_attachment_limit_exceeded` → `await load(tourId)` then `error.value = t('tours.attachments.limitRemaining', …)` from the refetched count; anything else → `t('tours.attachments.uploadFailed')`. `err.message` goes to `logger.error` only. Audit `remove` / `reorder` / `commitStaged` / `load` for the same raw-message leak
- [x] 8.4 `src/locales/en.json` + `src/locales/de-CH.json` — add `tours.attachments.uploadFailed`, `.uploading`, `.cancelUpload`, `.retryUpload`, `.dismissUpload` under the existing `tours.attachments` block. Reuse `limitRemaining` and `tours.infoSheet.cancelBtn` where they already fit — check before adding. Both locales in the same commit

## 9. Suggest-mode + GPX transport

- [x] 9.1 `src/features/tours/data/repositories/tour-suggestions-repository-impl.ts:140` `uploadStaged` — route through `uploadWithProgress` so one transport exists. Transport only: do NOT write into the attachments store's `pendingByTour` (cross-feature store reach, design D4)
- [ ] 9.2 (BLOCKED — no local Supabase stack in this environment, Docker unavailable; GPX keeps `supabase.storage.upload()` + the indeterminate spinner per this task's own fallback) `src/features/tours/data/services/gpx-storage-service.ts` — `uploadGpxToKey(key, file, opts?)` forwards `onProgress` / `signal` with `upsert: true`. **Verify a signed upload URL actually upserts an existing object** (GPX writes a stable `<uid>/<tourId>.gpx`). If it does not, revert this task to `supabase.storage.upload()` and keep the indeterminate spinner — do NOT let it block sections 2–8
- [ ] 9.3 (blocked by 9.2) `tour-form.vue` — swap `.gpx-spinner` (`:933`) for a `<progress>` fed by the reported fraction, keeping `isUploadingGpx` as the gate. Only if 9.2 held

## 10. Test

- [x] 10.1 `test/core/utils/storage-upload.test.ts` — stub `XMLHttpRequest`: abort mid-flight rejects with an `AbortError` (not a generic error); a 403 rejects with the status; an already-aborted signal rejects without sending. No happy-path case
- [x] 10.2 `test/features/tours/presentation/stores/tour-attachments-store.test.ts` — (a) a `list()` resolving with a stale snapshot AFTER a successful add does not clobber the added attachment; (b) `tour_attachment_limit_exceeded` refetches and surfaces the i18n remaining-capacity message, never the raw text; (c) a selection is rejected when persisted + in-flight would exceed 5; (d) three files named `image.jpg` become `image.jpg`/`image1.jpg`/`image2.jpg`; (e) cancelling one of three uploads leaves the other two uploading and evicts only the cancelled blob; (f) a failed upload leaves `uploading === false` so Save is not blocked
- [x] 10.3 `test/core/offline/blob-cache.test.ts` — `preferCache` with a cached blob issues NO fetch; without the flag the existing online-first order is unchanged (GPX regression guard)
- [x] 10.4 `npm run test` — all green

## 11. Device verification (not covered by CI)

- [x] 11.1 **Installed PWA on a real phone, throttled connection.** Add 4 photos to an existing tour: thumbnails appear immediately, progress advances per file, Save disabled until they finish. Re-open the tour — all 4 still listed (the issue's first screenshot pair), and re-opening issues no downloads (DevTools network on desktop for the same check)
- [x] 11.2 Same setup: cancel an upload at partial progress → Save re-enables at once, the cancelled file is absent, siblings survive, the edited tour name still saves
- [x] 11.3 Kill the connection mid-upload → failed row with Retry disabled; restore connection → Retry works without re-picking
- [x] 11.4 Create a NEW tour with 3 photos on a slow link → progress shows while still filling the form, Save waits, and the tour appears with all 3 attachments already present. Cancel a create with photos pre-uploaded → no rows, and the storage objects are gone
- [x] 11.5 Take 3 photos with the camera in succession → list shows `image.jpg`, `image1.jpg`, `image2.jpg`
- [x] 11.6 With 4 attachments, try to add 2 more, and separately pick 3 while 3 are uploading → both show the localized remaining-capacity message, never `tour_attachment_limit_exceeded: …`
- [ ] 11.7 Repeat 11.1 in mobile Safari and a desktop browser (issue asks for parity). Confirm GPX still uploads, blocks Save, and cleans up on cancel — and that a REPLACED GPX renders the new track, not the cached old one (the `preferCache` exclusion)
- [x] 11.8 Offline: open a previously-viewed tour → attachments still render from cache; the add control is disabled with the online-only hint (DC10 unchanged)

## 12. Finalize

- [x] 12.1 `npx eslint . --fix` (zero warnings) and `npm run type-check`
- [ ] 12.2 Prompt the user to commit — suggested message:
  ```
  fix(tours): stop stale reads clobbering uploaded attachments

  A list() in flight could overwrite a completed add/remove/reorder, so a
  tour showed zero attachments after uploading five and then surfaced the
  raw cap-trigger exception on re-add. Guard reads with a write sequence,
  and count in-flight files against the cap.

  Uploads now run per file through an XHR signed-URL transport with real
  progress, abort and retry, pre-upload in the create flow like GPX, and
  block Save until settled. Attachment bytes read cache-first, so a picked
  file shows instantly and re-opening a tour downloads nothing. Colliding
  filenames are numbered.

  Closes #285

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- [ ] 12.3 Prompt the user to push and open a PR against `main`
- [ ] 12.4 Prompt the user to archive this change with the `openspec-archive` skill
