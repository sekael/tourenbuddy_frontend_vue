## 1. Git Setup

- [x] 1.1 Create branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/gpx-storage-user-prefix-path`

## 2. Database migration

- [x] 2.1 Add migration `supabase/migrations/20260503_gpx_storage_user_prefix.sql` that drops the four existing `tour-gpx` policies (`tour-gpx owner select|insert|update|delete`) on `storage.objects`
- [x] 2.2 In the same migration, `DROP FUNCTION IF EXISTS public.tour_id_from_gpx_path(text)`
- [x] 2.3 Create new INSERT/UPDATE/DELETE policies on `storage.objects` for `bucket_id = 'tour-gpx'` whose only authorisation clause is `(storage.foldername(name))[1] = auth.uid()::text`
- [x] 2.4 Create new SELECT policy that joins `public.tours` on the path's second segment using a defensive comparison (`t.id::text = (storage.foldername(name))[2]` with the `.gpx` suffix stripped) and authorises `t.user_id = auth.uid()`; structure as a single `EXISTS` so future shared/public clauses can be added with `OR`
- [x] 2.5 Add a header comment to the migration warning devs to manually clean any pre-existing dev-only objects in the `tour-gpx` bucket before applying
- [x] 2.6 Confirm `delete_tour_gpx_object` trigger is unchanged (it forwards `old.gpx_filepath` verbatim, which is the full new key)
- [x] 2.7 Apply migration locally and verify (a) authenticated upload to `${auth.uid()}/${randomUUID}.gpx` succeeds without a `tours` row, (b) upload to a different user's prefix is denied, (c) SELECT for an owned tour's track succeeds, (d) SELECT for a non-owned track is denied, (e) a deliberately malformed object name does not raise during policy eval
  - Note: SELECT policy bug fixed — changed `(storage.foldername(name))[2]` to `split_part(name,'/',2)` so the tour-id segment is correctly extracted from the filename

## 3. Storage service

- [x] 3.1 Update `src/features/tours/data/services/gpx-storage-service.ts`: change `uploadGpx` signature to `uploadGpx(userId: string, tourId: string, file: File): Promise<string>` and build the key as `${userId}/${tourId}.gpx`
- [x] 3.2 Leave `removeGpx(filepath)`, `getSignedUrl(filepath)`, and `downloadOriginal(filepath, fallbackName)` unchanged
- [x] 3.3 Update `test/features/tours/data/services/gpx-storage-service.test.ts` to assert the new key format `${userId}/${tourId}.gpx` is passed to `supabase.storage.from(BUCKET).upload`

## 4. Tour form pre-upload wiring

- [x] 4.1 In `src/features/tours/presentation/components/tour-form.vue`, import `useAuthStore` and resolve `userId` from `authStore.currentUser?.id` at file-pick time; bail with the existing upload error if it is missing
- [x] 4.2 On valid file pick (when `preUploadGpx` is true), generate `tourId = crypto.randomUUID()` and stash it on a ref; call `uploadGpx(userId, tourId, file)`; on success store the returned full key in `pendingGpxKey` and remember `tourId` so submit can pass it through
- [x] 4.3 If the user picks a new file before submit, delete the previous `pendingGpxKey` via `removeGpx` (best-effort) and generate a fresh `tourId`
- [x] 4.4 On dialog cancel or remove-track action, delete `pendingGpxKey` via `removeGpx` (best-effort) using the same flag-and-cleanup pattern already in place for in-flight uploads
- [x] 4.5 On submit in create mode, emit the stashed `tourId` to the parent (extend the `submit` event payload or expose it via a separate emit/prop) so the store uses the same id when calling `create_tour_full`

## 5. Tours store integration

- [x] 5.1 In `src/features/tours/presentation/stores/tours-store.ts`, change `createTourFromDraft` to accept an optional `tourId` argument from the form (defaulting to `uuidv4()` when not pre-uploaded) and use it in place of the locally generated id
- [x] 5.2 In `updateTour`, when a new `gpxFile` is supplied, call `uploadGpx(userId, id, gpxFile)` (sourcing `userId` from `authStore.currentUser.id`) instead of the previous two-arg call; assert via test that the resulting filepath is the user-prefixed key
- [x] 5.3 Verify `deleteTour` continues to work unchanged (it passes `tour.gpxFilepath` to `removeGpx`)

## 6. Caller updates

- [x] 6.1 Update `tour-creation-dialog.vue` and `tour-edit` flows so the new `tourId` (when emitted by the form) is forwarded to `createTourFromDraft`
- [x] 6.2 Confirm map/gpx-track-layer continues to fetch via `getSignedUrl(tour.gpxFilepath)` — no changes needed since it already passes the stored full path

## 7. Tests

- [x] 7.1 Update `gpx-storage-service.test.ts` for the new key layout (3.3)
- [x] 7.2 Update `tours-store` tests where `uploadGpx` is mocked, asserting the new `(userId, tourId, file)` argument shape
- [x] 7.3 Add a unit test for `tour-form` covering: pre-upload triggered on valid pick, Save disabled while uploading, file replacement deletes prior pending object, cancel deletes pending object
- [x] 7.4 Run full suite: `npm run test`

## 8. Manual verification

- [x] 8.1 In a clean dev project: create a tour with a GPX file → verify spinner shows, Save is blocked, on submit the tour appears with track rendered, and the storage object lives at `${userId}/${tourId}.gpx`
- [x] 8.2 Cancel mid-upload → verify the orphan is removed from the bucket
- [x] 8.3 Edit an existing tour, replace its GPX → verify the object at `${userId}/${tourId}.gpx` is overwritten and the rendered track updates
- [x] 8.4 Delete a tour with a GPX → verify the storage object is gone (client path) and re-test with the trigger fallback by deleting via SQL
- [x] 8.5 Sign in as user B and attempt to fetch user A's signed URL → verify denial

## 9. Finalize

- [x] 9.1 Run `npx eslint . --fix && npm run format && npm run type-check && npm run test`
- [x] 9.2 Prompt the user to commit with the message: `feat(tours): switch GPX storage to user-prefixed paths to enable pre-upload`
- [x] 9.3 Prompt the user to push the branch and open a PR; include in the PR body a link to this OpenSpec change and a note on the migration's no-backfill rationale
- [x] 9.4 After merge, prompt the user to run `openspec-archive` for `gpx-storage-user-prefixed-paths`
