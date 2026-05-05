## Context

GPX storage shipped in #61 (merged on `feat/61-gpx-track-storage`, present on `main` as of `c620614`). The original design chose a tour-id-rooted path `${tourId}.gpx` to keep the storage layout owner-agnostic, betting that visibility evolution (private / shared / public) would only require RLS edits. RLS policies on `storage.objects` resolve `name → tourId` via `public.tour_id_from_gpx_path(text)::uuid` and join `tours` to authorise.

Two problems surfaced in practice:

1. **Pre-upload is impossible.** Issue #61 itself flagged the desire for pre-upload (spinner + blocked Save). With the current scheme, no `tours` row exists at file-pick time, so the INSERT policy denies the upload. Workarounds — temp tour rows, post-submit upload — either pollute the data model or regress UX.
2. **Policy fragility.** Any storage object whose name is not a valid UUID makes `tour_id_from_gpx_path` raise `invalid input syntax for type uuid` during policy eval. Even a single dev-leftover object can wedge the bucket. (User confirmed bucket is currently clean, but the failure mode is unacceptable.)

We need write-time authorisation that does not depend on a `tours` row existing. The Supabase-canonical pattern — first path segment = `auth.uid()` — solves this cleanly.

## Goals / Non-Goals

**Goals:**

- Allow GPX upload before the `tours` row exists, so create-flow can pre-upload on file pick with a visible spinner and a blocked Save button.
- Keep RLS robust: write-policy evaluation must not depend on row joins or string casts that can fail.
- Preserve forward-compatibility: shared and public visibility must be addable later by editing only the SELECT policy, with zero re-keying of existing objects.
- Maintain owner-only semantics today (no behaviour change for existing users).
- Keep the `delete_tour_gpx_object` trigger working without modification (it forwards the stored path verbatim).

**Non-Goals:**

- Implement shared or public visibility now. We design the policy structure to make it additive, but no `is_public`, `tour_shares`, or friendship-based read policies ship in this change.
- Re-architect the `gpx-track-support` capability beyond path + write-RLS. Lazy fetch, caching, rendering, download, and i18n are untouched.
- Backfill existing objects. Production has no `gpx_filepath` rows yet (verified by user); a clean cut-over avoids backfill complexity.
- Abort in-flight Supabase uploads. The JS client offers no abort signal; we keep the existing "best-effort cleanup" pattern (delete the orphan after the upload resolves if cancelled).

## Decisions

### 1. Path scheme: `${userId}/${tourId}.gpx`

The first path segment is the uploader's `auth.uid()`. The second is the tour id (UUID generated client-side, used both for storage and for the eventual `tours.id`).

**Why this format:**

- INSERT/UPDATE/DELETE can be authorised purely by checking `(storage.foldername(name))[1] = auth.uid()::text`. No join, no cast, no helper function. This is the canonical Supabase pattern and the failure mode is impossible-by-construction.
- The tour id remains in the path, so the trigger can still locate and delete the object via `old.gpx_filepath`, and so future SELECT policies can join `tours` on the second segment without parsing.
- The user prefix encodes the **uploader**, not the **reader**. Read policies can extend independently — see decision (3).

**Alternatives considered:**

- _Random object id under user prefix (`${userId}/${randomId}.gpx`):_ loses the tour-id-in-path linkage that the delete trigger and future shared-read policies rely on. Rejected.
- _Keep tour-id-only, pre-create the tour row:_ requires inserting a "draft" tour with placeholder values just to allow upload, which leaks half-state into the table and complicates cancel. Rejected.
- _Keep tour-id-only, drop pre-upload:_ regresses UX (no spinner during multi-MB upload, Save can hang). Rejected per user requirement.

### 2. Write authorisation by path prefix only

INSERT, UPDATE, DELETE policies on `storage.objects` for `bucket_id = 'tour-gpx'` use:

```sql
(storage.foldername(name))[1] = auth.uid()::text
```

No reference to `public.tours`. A user can write any object under their own prefix — even before a tour row exists. This is safe because:

- Storage quota is bounded per-user via the 5 MB client-side cap and the bucket's per-object size limit.
- Orphaned objects (upload then cancel) are cleaned up client-side; the trigger remains the row-deletion fallback.
- `auth.uid()::text` is null for anonymous calls → policy denies, matching current behaviour.

### 3. Read authorisation: owner today, structured for extension

SELECT policy stays joined to `tours`:

```sql
bucket_id = 'tour-gpx'
AND EXISTS (
  SELECT 1 FROM public.tours t
  WHERE t.id::text = (storage.foldername(name))[2]  -- strip ".gpx" via split or substring
    AND t.user_id = auth.uid()
)
```

The path-to-tour-id extraction in this policy is **defensive**: if the second segment isn't a valid UUID, the comparison simply yields no rows — no exception. We compare on `t.id::text` rather than casting the path segment to UUID, so malformed names cannot raise.

When sharing / public visibility lands, the `EXISTS` clause grows additional `OR` branches (e.g., `OR EXISTS (SELECT 1 FROM tour_shares WHERE ...)`, `OR EXISTS (SELECT 1 FROM tours WHERE is_public)`). The path scheme does not change.

### 4. Drop `tour_id_from_gpx_path`

The helper was tied to the legacy single-segment path scheme (`${tourId}.gpx`). With the new scheme, splitting via `storage.foldername(name)` is built-in and safer (no exceptions on malformed names). We `DROP FUNCTION IF EXISTS public.tour_id_from_gpx_path(text)`.

### 5. Tour id generated client-side, used as both storage segment and `tours.id`

The form generates `tourId = crypto.randomUUID()` on file pick, uploads to `${userId}/${tourId}.gpx`, and threads the same `tourId` through to `createTourFromDraft`. The store passes that id to `create_tour_full(p_id := tourId, ...)`. After creation, the storage path and the `tours.id` are aligned, which keeps the trigger and future shared-read SELECT policy simple.

If the user picks a different file before submitting, we delete the prior `${userId}/${oldTourId}.gpx` (best-effort) and generate a fresh `tourId`.

If the user cancels, we delete the in-flight (or completed) upload and discard the `tourId` — no `tours` row was ever inserted.

### 6. `gpx-storage-service.uploadGpx` signature change

```ts
export async function uploadGpx(userId: string, tourId: string, file: File): Promise<string>
```

Returns the full key `${userId}/${tourId}.gpx`. Callers (form pre-upload, store edit-mode upload) source `userId` from `useAuthStore().currentUser.id`. `removeGpx(filepath: string)` is unchanged from the prior session's refactor.

### 7. No backfill, single-cut migration

The migration drops old policies, drops the helper, recreates the four policies. There are no production rows with `gpx_filepath`. Dev databases with stale objects must be cleaned manually (acceptable; we document this).

## Risks / Trade-offs

- **[Risk] Orphan objects from cancelled or crashed uploads** → Mitigation: client deletes the object on cancel; future periodic sweeper job (out of scope) can reconcile `tours.gpx_filepath` against bucket listings per user prefix. The user prefix actually makes such a sweeper _easier_ than the flat layout did.
- **[Risk] User prefix exposes the user UUID in object paths** → Trade-off accepted. The UUID is already exposed via `tours.user_id` in client queries, signed URLs are short-lived, and the bucket is private. No additional information leaks.
- **[Risk] Migrating dev environments with stale `${tourId}.gpx` objects breaks the bucket listing UI** → Mitigation: migration includes a comment instructing devs to drop dev-only objects manually before applying. Production is empty.
- **[Risk] Pre-upload before a tour row exists could be abused to fill storage with orphans** → Mitigation: 5 MB client cap, plus per-user storage quota at the Supabase project level. Abuse vector exists today for any authenticated user uploading to any bucket they have write access to; not unique to this design.
- **[Trade-off] Path now encodes the uploader, not the readers.** Some teams prefer reader-agnostic paths to centralise authorisation. We accept this because the SELECT policy still joins `tours`, which carries the visibility metadata. Path encodes "who put this here" — a closer match to Storage's model.

## Migration Plan

1. Apply the new migration `20260503_gpx_storage_user_prefix.sql`:
   - `DROP POLICY` for the four existing `tour-gpx` policies.
   - `DROP FUNCTION IF EXISTS public.tour_id_from_gpx_path(text)`.
   - `CREATE POLICY` for the four new policies (write = path prefix, read = tour join with defensive comparison).
2. Update `gpx-storage-service.ts` (signature change), call sites, and tests in the same PR.
3. Verify via Supabase dashboard that the bucket has no objects (production); dev: prompt devs to clean their bucket.
4. Rollback strategy: revert the migration (re-create old policies + helper) and revert the frontend change. Since no objects exist with the new layout in production, rollback is symmetric.

## Open Questions

None. Sharing / public visibility design is intentionally deferred and is additive on this foundation.
