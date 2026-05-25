## Why

Tour planners need visual route details (topos, scans, route photos, PDF guides) attached to tours. Today only GPX tracks and notes exist — users have no place to put the supporting documents they actually carry into the mountains. Closes #177.

## What Changes

- New per-tour attachments: up to 5 files, types `image/png`, `image/jpeg`, `application/pdf`, max 10 MB each.
- Attachments managed during tour creation AND editing: add, delete, reorder.
- Files stored in a NEW private Supabase Storage bucket `tour-attachments`, separate from the existing GPX bucket.
- Owner-only access via RLS; reads use short-lived signed URLs (no public URLs).
- In-app full-screen viewer with horizontal swipe/flip between files; images rendered natively, PDFs rendered with `pdfjs-dist`.
- All files downloadable from the viewer.
- New DB migration: `tour_attachments` table (with `sort_order`), bucket, storage RLS policies.
- i18n keys added to `en.json` and `de-CH.json`.

## Capabilities

### New Capabilities
- `tour-attachments`: per-tour file attachments (upload, list, reorder, delete) and the in-app full-screen viewer for images + PDFs.

### Modified Capabilities
- `tour-form-extended`: tour form gains an attachments picker section integrated into create/edit flows.
- `tour-info-extended`: tour info surface exposes the attachments list and entry point to the viewer.

## Impact

- **Code:** `src/features/tours/{data,domain,presentation}/...` — new entity, repo iface + Supabase impl, Pinia store, picker + viewer components. Tour form + info pages wired to new store.
- **Deps:** add `pdfjs-dist` (PDF rendering). Worker bundled via Vite.
- **DB / Infra:** new migration creating `tour_attachments` table, `tour-attachments` storage bucket, RLS + storage policies (owner-only read/write/delete).
- **PWA:** signed URLs are short-lived and per-request — exclude from runtime cache to avoid serving stale/expired blobs.
- **i18n:** new keys in `en.json`, `de-CH.json`.
- **Tests:** new unit/component tests for store + repo + viewer (edge cases only, per testing convention).
- **Forward-compat note:** friendship-based tour sharing is on the roadmap. This change ships owner-only RLS mirroring `tours_*_own`. When sharing lands, the sharing PR will rewrite tour + tour_attachments policies in lockstep AND release notes must warn that shared image attachments expose retained EXIF (incl. GPS) to friends.
