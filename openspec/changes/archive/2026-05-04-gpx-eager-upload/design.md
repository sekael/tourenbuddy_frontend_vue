## Context

`tour-form.vue` already implements eager upload behind a `preUploadGpx` boolean. Create flow (`tour-creation-dialog.vue`) sets it `true`; edit flow (`tour-info-sheet.vue`) sets it `false` and uploads via `toursStore.updateTour(... gpxFile)` on save. Submit button uses `:disabled` only against an `isUploadingGpx` ref but lacks visual disabled styling distinct from default. Existing-track row renders Replace + Remove with text labels.

## Goals / Non-Goals

**Goals:**

- Single eager-upload code path used by both create and edit.
- Save button visually disabled (greyed out, cursor not-allowed) while upload in flight.
- Cancel during upload aborts and removes any orphaned blob.
- Existing-track replace/remove become icon-only with `title` tooltips.

**Non-Goals:**

- Reworking `gpx-storage-service` API (no abort signal — keep cancel-via-flag).
- Resumable uploads, retry UI, progress percentage.

## Decisions

**Decision 1: Always pre-upload — drop `preUploadGpx` prop**
Both modes use the same flow. Caller of `updateTour` passes a pre-uploaded storage key (or null/removed flag), never a `File`.
Alternatives: keep prop and just flip it true in edit caller. Rejected — extra surface for no benefit.

**Decision 2: Cancel-via-flag, not AbortController**
`gpx-storage-service.uploadGpx` doesn't take a signal. Keep existing `wasCancelledDuringUpload` ref pattern: when set, `finally` deletes the returned key. Cheap, already proven in create flow.
Alternative: thread AbortController through Supabase client. Rejected — Supabase-js storage upload doesn't support abort cleanly; mid-flight bytes are wasted either way.

**Decision 3: Disabled styling via `.submit-btn:disabled` rule**
Add CSS for the disabled state (opacity, cursor, no hover transform). Already-bound `:disabled` attribute remains the source of truth.

**Decision 4: Icon-only replace/remove for existing tracks**
Reuse existing `.gpx-action-btn` style; remove text content, keep icon, add `title` and `aria-label`. Visible filename in chip is enough context.

## Risks / Trade-offs

- **Orphaned blobs on tab close mid-upload** → Mitigation: server-side TTL cleanup is out of scope; mid-upload tab close is rare and same risk exists today in create flow.
- **User edits other fields, then cancels** → Same as today: cancel = no save, GPX upload is rolled back. No new risk.
- **Pre-upload uses a tour ID generated client-side that never gets persisted on cancel** → Acceptable; storage path includes user prefix and the orphaned object is deleted on cancel.
