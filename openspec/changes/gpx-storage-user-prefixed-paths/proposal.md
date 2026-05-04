## Why

The current GPX storage scheme keys objects as `${tourId}.gpx` and gates RLS on the existence of a `tours` row joined via a path-derived UUID. This breaks pre-upload at create time: when the user picks a `.gpx` file in the create dialog, no tour row exists yet, so the INSERT policy denies the upload (observed: 400 from Supabase Storage). It also makes the policy fragile — any object whose name does not parse as a UUID makes the policy function raise during evaluation.

We need a path scheme that lets us upload before a tour row exists (so we can show a spinner and block Save while the file uploads), without giving up the ability to evolve to shared and public visibility later.

## What Changes

- **BREAKING (storage layout)** Object key changes from `${tourId}.gpx` to `${userId}/${tourId}.gpx`. The user prefix encodes the uploader, not the readers — read access remains open to future visibility models.
- Rewrite `tour-gpx` RLS policies on `storage.objects`:
  - **INSERT/UPDATE/DELETE**: authorised by `(storage.foldername(name))[1] = auth.uid()::text` — pure path check, no join to `tours`. Decouples write authorisation from tour-row existence and enables pre-upload.
  - **SELECT**: today, owner-only via join to `tours.user_id`; structured so that `OR` clauses for shared / public tours can be added later without re-keying objects or rewriting INSERT policies.
- Drop the `public.tour_id_from_gpx_path(text)` helper — no longer used by any policy.
- Pre-upload on file pick in create mode: form generates `tourId = crypto.randomUUID()` up front, uploads to `${userId}/${tourId}.gpx` immediately, shows spinner, blocks Save until upload completes. Cancel during in-flight upload removes the orphaned object.
- `gpx-storage-service.uploadGpx(userId, tourId, file)` takes both ids; returns the full key. `removeGpx(filepath)` already takes a raw path (no change).
- The `delete_tour_gpx_object` trigger continues to call `storage.delete_object('tour-gpx', old.gpx_filepath)` — it forwards the stored path verbatim, so the new format works without trigger changes.
- No backfill: GPX storage shipped in #61 and prod has no rows with `gpx_filepath` set yet (verified empty bucket modulo dev artefacts).

## Capabilities

### New Capabilities

<!-- None — this change refines an existing capability. -->

### Modified Capabilities

- `gpx-tracks`: Path scheme, bucket access policies, and upload UX (pre-upload + cancel) change. Rendering, lazy fetch, download, and i18n requirements are unchanged.

## Impact

- **DB / Storage**: new migration that drops the four existing `tour-gpx` policies and `tour_id_from_gpx_path` helper, then recreates owner-prefix INSERT/UPDATE/DELETE policies and an owner-via-`tours` SELECT policy. Trigger `delete_tour_gpx_object` unchanged.
- **Frontend**:
  - `features/tours/data/services/gpx-storage-service.ts` — `uploadGpx` signature gains `userId`, builds `${userId}/${tourId}.gpx`.
  - `features/tours/presentation/components/tour-form.vue` — pre-upload in create mode (existing `preUploadGpx` prop wiring already in branch); fetch `userId` from `useAuthStore`; generate persistent `tourId` per file pick; cancel cleanup unchanged.
  - `features/tours/presentation/stores/tours-store.ts` — `createTourFromDraft` accepts the pre-uploaded path and skips re-upload (already in branch); on edit, `uploadGpx(userId, tourId, file)` call updates.
  - `features/tours/presentation/components/tour-creation-dialog.vue` — already passes `:pre-upload-gpx="true"`.
- **Tests**: update `gpx-storage-service.test.ts` upload assertions for the new key layout; update `tours-store.test.ts` upload calls.
- **Forward-compat note**: when shared/public-tour features land, only the SELECT policy gains additional clauses (e.g. `OR EXISTS (... tour_shares ...)`, `OR EXISTS (... tours WHERE is_public)`); no path migration required.
- **Constraint**: 5 MB client-side cap unchanged.
