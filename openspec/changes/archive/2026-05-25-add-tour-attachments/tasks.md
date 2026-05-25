## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/177-tour-attachments`

## 2. Database & Storage Migration

- [x] 2.1 Create migration: `supabase migration new tour_attachments`
- [x] 2.2 Add `tour_attachments` table with columns per design.md (`id`, `tour_id`, `user_id`, `storage_path`, `mime_type`, `size_bytes`, `original_filename`, `sort_order`, `created_at`), CHECK constraints on `mime_type` and `size_bytes`, index `(tour_id, sort_order)`
- [x] 2.3 Add RLS on `tour_attachments`: owner-only `select/insert/update/delete` (`user_id = auth.uid()`) — mirror existing `tours_*_own` policy shape
- [x] 2.4 Add `before insert` trigger enforcing 5-row cap per `tour_id` (use `SELECT ... FOR UPDATE` on parent tour row)
- [x] 2.5 Create private storage bucket `tour-attachments` and owner-only storage policies (path prefix matches `auth.uid()::text` via `split_part(name,'/',1)`)
- [x] 2.6 Add RPC `update_attachment_order(tour_id uuid, ordered_ids uuid[])` updating `sort_order` transactionally for caller-owned rows
- [x] 2.7 Apply locally with `supabase db reset` and verify schema/policies via psql or Studio against local stack

## 3. Domain & Data Layer

- [x] 3.1 Add Zod model + inferred type in `src/features/tours/data/models/tour-attachment.ts`
- [x] 3.2 Add domain entity `TourAttachment` in `src/features/tours/domain/entities/tour-attachment.ts`
- [x] 3.3 Add repository interface `TourAttachmentRepository` in `src/features/tours/domain/repositories/tour-attachment-repository.ts` (list, add, delete, reorder, getViewUrl, getDownloadUrl)
- [x] 3.4 Implement `SupabaseTourAttachmentRepository` in `src/features/tours/data/repositories/` (upload → insert with cleanup on row failure; signed URL TTL ≤ 5 min)
- [x] 3.5 Add allowed-mime + size constants in `src/features/tours/data/models/` and reuse in client validation

## 4. Presentation – Store

- [x] 4.1 Add Pinia store `useTourAttachmentsStore` in `src/features/tours/presentation/stores/` with `loading`, `error`, `attachmentsByTour` state, `stagedByDraft` for create-flow staging, and actions `load(tourId)`, `stage(draftId, files[])`, `add(tourId, files[])`, `commitStaged(draftId, tourId)`, `remove(id)`, `reorder(tourId, orderedIds)`
- [x] 4.2 Enforce 5-file cap + mime + size + HEIC-specific rejection in store actions before repo call; batch reject when selection would exceed remaining capacity
- [x] 4.3 Unit tests for store: rejects 6th file, rejects bad mime, rejects HEIC with dedicated error code, rejects oversize, rejects batch over remaining cap, rolls back optimistic add on repo failure, `commitStaged` no-ops when staged list empty

## 5. Presentation – Components

- [x] 5.1 Add `tour-attachments-picker.vue` (used in form): list rows with drag handle + delete (w/ confirm dialog) + single "Add file" button using `<input type="file" multiple accept="image/png,image/jpeg,application/pdf">` (no `capture` attr); calls store stage during create, store add during edit
- [x] 5.2 Add `tour-attachments-strip.vue` (used in info sheet): horizontal thumbnails, opens viewer on tap
- [x] 5.3 Add `tour-attachment-viewer.vue`: full-screen, swipe + arrow controls to flip between files, native `<img>` for images, dynamic `import('pdfjs-dist')` for PDFs with page-by-page navigation, download button
- [x] 5.4 Wire viewer to regenerate signed URL on 403/expired load error (retry once)
- [x] 5.5 Component tests (edge cases only): viewer flips at boundaries, PDF lazy import, download triggers correct filename, expired-URL retry path

## 6. Wiring & Integration

- [x] 6.1 Add `pdfjs-dist` to `package.json` and configure Vite worker import in `vite.config.ts`
- [x] 6.2 Mount `tour-attachments-picker.vue` in the tour create/edit form; wire create-flow submit handler to call `commitStaged(draftId, newTourId)` AFTER the tours insert resolves
- [x] 6.3 Mount `tour-attachments-strip.vue` in the tour info sheet
- [x] 6.4 In `vite.config.ts` PWA `runtimeCaching`, add a `NetworkOnly` rule for the `tour-attachments` storage URL path so signed URLs bypass the SW cache

## 7. i18n

- [x] 7.1 Add new keys under `tours.attachments.*` (e.g. `add`, `delete`, `deleteConfirm.title`, `deleteConfirm.body`, `limitReached`, `limitRemaining`, `invalidType`, `heicUnsupported`, `tooLarge`, `download`, `viewer.next`, `viewer.previous`, `viewer.page`) to `src/i18n/en.json`
- [x] 7.2 Mirror the same keys with German translations in `src/i18n/de-CH.json`

## 8. Verification

- [x] 8.1 Run `npm run test` — all 855 pass
- [x] 8.2 Run `npm run type-check` — clean
- [x] 8.3 Manual local verify: CREATE tour with 3 staged files → submit → files appear; EDIT tour → add 2 more → reorder → delete one (confirm dialog) → open viewer → flip between image+PDF → download → reload page, state intact
- [x] 8.4 Manual local verify rejections: 6th upload blocked, batch of 4 when 2 slots left blocked, oversize file blocked, `.gif` blocked, HEIC blocked with dedicated message, signed-URL expiry path (artificially drop TTL or wait)
- [x] 8.5 Manual local verify abort: stage 2 files in create form → close form without submitting → no rows in `tour_attachments`, no objects in `tour-attachments` bucket

## 9. Finalize

- [x] 9.1 Run `npx eslint . --fix` (zero warnings required by CI)
- [x] 9.2 Prompt user to commit with ready-to-copy message: `feat(tours): add image and PDF attachments (#177)`
- [x] 9.3 Prompt user to push branch and open PR against `main` referencing #177
- [x] 9.4 After PR merge: prompt user to run `supabase db push` to apply the migration to prod
