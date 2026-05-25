## Context

Tours currently support a GPX track and structured metadata only. Issue #177 asks for visual route artifacts (topos, scans, photos, PDF guides) to be attached to a tour, downloaded, and viewed in-app. GPX files already live in a Supabase Storage bucket with owner-only RLS; that pattern is the precedent.

Constraints:
- Supabase free tier — minimize round trips and bucket count growth.
- PWA — service worker is configured to cache Swisstopo tiles only. Attachment URLs are short-lived signed URLs and MUST NOT be cached.
- iOS Safari + Android WebView — inconsistent native PDF support; we cannot rely on `<iframe src=*.pdf>` rendering reliably.
- Bundle size matters (Cloudflare Pages, mobile install). `pdfjs-dist` is ~300 KB gz including worker; acceptable for a feature that explicitly requires in-app PDF display.

## Goals / Non-Goals

**Goals:**
- Per-tour attachments: up to 5 files, png/jpeg/pdf, ≤10 MB each.
- Owner-only access; no public URLs.
- Add/delete/reorder during tour create AND edit.
- Full-screen in-app viewer with horizontal flip between files; native image render; pdf.js render for PDFs.
- Download original file from viewer.

**Non-Goals:**
- Offline access to attachments (PWA does not cache them).
- Sharing attachments with other users (no friendship/share path in this change).
- Server-side thumbnails or transforms (Supabase Storage image transforms not used; native `<img>` is sufficient for ≤10 MB images).
- Editing files (rotate, annotate, crop).
- Video, GPX-as-attachment, or arbitrary file types.

## Decisions

### D1. Separate Supabase Storage bucket `tour-attachments`
Keep GPX track bucket untouched; different policies, different lifecycle, different access patterns. Bucket is **private**; reads always via signed URL.

Alternatives considered: single multi-purpose bucket with prefix-based RLS — rejected, couples unrelated policies and complicates future per-bucket quotas/lifecycle rules.

### D2. New `tour_attachments` table (not a JSON column on `tours`)
Schema:
```
tour_attachments (
  id uuid pk default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,         -- e.g. <user_id>/<tour_id>/<uuid>.<ext>
  mime_type text not null check (mime_type in ('image/png','image/jpeg','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  original_filename text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
)
```
Indexes: `(tour_id, sort_order)`. RLS: owner-only `select/insert/update/delete` keyed on `user_id = auth.uid()` — matches the existing `tours_*_own` pattern (no helper abstraction yet). Friendship-based sharing is on the roadmap and will rewrite these policies in lockstep with the corresponding `tours` policy change; not pre-abstracted here.

Rationale: enables reorder via `sort_order`, atomic per-row delete, FK cascade on tour deletion, and a per-tour COUNT to enforce the 5-file limit via a DB trigger as a defense in depth.

Alternatives: JSON column on `tours` — rejected, painful for reorder + per-file RLS + count constraint.

### D3. 5-file cap enforced at three layers
1. Client store: blocks selection above 5.
2. DB trigger: `before insert on tour_attachments` raises if count for `tour_id` already ≥ 5.
3. Storage policy: not enforceable per-tour at storage layer; relies on (1)+(2).

### D4. Storage path layout `<user_id>/<tour_id>/<attachment_uuid>.<ext>`
- Owner prefix lets storage RLS check ownership cheaply via path (`split_part(name,'/',1) = auth.uid()::text`).
- Attachment UUID prevents collisions and makes deletion trivial without listing.

### D5. Signed URLs, short TTL (5 min), generated on-demand
- Viewer requests a signed URL the moment a file becomes active (current or adjacent for prefetch).
- Download button creates a separate short-lived signed URL with `download` flag.
- No signed URL is persisted in store beyond the current session view.

PWA: `vite-plugin-pwa` runtime cache rules exclude the `tour-attachments` storage origin/path.

### D6. PDF rendering via `pdfjs-dist`
- Lazy import in the viewer component so non-PDF flows don't pay the cost.
- Worker bundled via Vite (`pdfjs-dist/build/pdf.worker.min.mjs` as a worker URL).
- Render one page at a time, page navigation inside the viewer separate from inter-file flip.

Alternatives: native `<embed>`/`<iframe>` — rejected for iOS inconsistency. External open — conflicts with issue.

### D7. Reorder UX = drag handle in edit mode
Reorder writes new `sort_order` values in a single Supabase RPC (`update_attachment_order(tour_id, ordered_ids[])`) inside a transaction to avoid partial state.

### D8. Upload flow
1. Client validates count + mime + size client-side.
2. Upload to storage at computed path.
3. On success, insert `tour_attachments` row.
4. On row insert failure, best-effort delete the orphaned storage object.

The reverse order (row first, upload second) would leave orphan rows on storage failure; we prefer orphan blobs (cheaper to GC) over orphan rows (visible bug).

### D9. Create-flow staging (no draft tour row)
During tour create the `tour_id` does not yet exist. The attachments store SHALL keep selected `File` objects in memory (with client-side validation already applied) and SHALL only upload + insert rows AFTER the `tours` insert returns the new `tour_id`. On submit, uploads run in parallel; submit progress reflects the combined state. Rationale:
- No draft `tours` rows to garbage-collect.
- No partial DB state if the user cancels mid-form.
- Trade-off: files are lost on tab crash before submit — acceptable while user is actively in the form.

### D10. HEIC handling
iOS native camera format is HEIC, which is NOT in the allowed mime list and cannot be rendered by `<img>` in Chrome/Firefox/Android. The picker SHALL reject HEIC explicitly with a clear localized error ("HEIC not supported — please share as JPEG"), not the generic "invalid type". The standard iOS Photos share-sheet picker converts to JPEG by default in most flows; the explicit error covers the edge where it does not.

### D11. EXIF metadata retained
Image EXIF (incl. GPS, capture date, camera) is NOT stripped on upload. Attachments are owner-only via RLS + signed URLs, so leakage risk is bounded to the owner today. Friendship-based sharing is on the roadmap; when it lands, release notes MUST warn users that shared image attachments expose their EXIF (incl. GPS) to friends, and we revisit (optional strip at upload, or strip-on-share).

### D12. File picker UX
Single "Add file" button using `<input type="file" multiple accept="image/png,image/jpeg,application/pdf">`. No `capture` attribute — the OS picker handles gallery / camera / files. `multiple` is enabled; if a selection batch would push the tour above 5 attachments total, the WHOLE batch is rejected with an error stating the remaining capacity (e.g. "You can add 3 more files; you selected 7"). Web APIs do not expose an OS-level max-count cap, so this client-side batch check is the strictest available.

### D13. Delete UX
Hard delete with a confirm dialog. No soft-delete / undo. Matches existing destructive ops in the app.

## Risks / Trade-offs

- **Orphaned storage objects** on partial failure → Mitigation: best-effort cleanup + later add a scheduled cleanup that deletes storage objects with no matching row (out of scope here).
- **pdfjs bundle weight (~300 KB gz)** → Mitigation: dynamic import only inside the viewer; route-level chunk.
- **Signed URL expiry mid-view** for slow connections / paused viewer → Mitigation: regenerate signed URL on viewer focus and on demand if image/PDF load errors with a 403/expired marker.
- **DB trigger 5-file race** under concurrent inserts → trigger uses `SELECT ... FOR UPDATE` on the parent tour row to serialize.
- **Large PDFs (close to 10 MB) on low-end devices** → Mitigation: render page-by-page, not all pages at once; show a loading state.
- **PWA caching of expired signed URLs** would serve broken files → Mitigation: explicit exclude in workbox runtime cache config.

## Migration Plan

1. New migration `supabase/migrations/<ts>_tour_attachments.sql`:
   - Create `tour_attachments` table + indexes + RLS.
   - Create bucket `tour-attachments` (private) + storage policies (owner-only via path prefix).
   - Create `before insert` trigger for 5-file cap.
   - Create `update_attachment_order` RPC.
2. Apply locally via `supabase db reset`; verify with feature tests.
3. After review, `supabase db push` (prompt user).
4. No data backfill — feature is additive.

Rollback: drop trigger, RPC, policies, table, bucket in a follow-up migration. No existing rows depend on this.

## Open Questions

- Should reorder be available on mobile via long-press, drag handle, or up/down buttons? Default to drag handle with up/down fallback for accessibility; revisit after design pass.
- Future: do we want server-generated image thumbnails to cut viewer bandwidth? Deferred — not needed at ≤10 MB and ≤5 files.
