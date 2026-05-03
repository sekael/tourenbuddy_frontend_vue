## Context

Tours already have a working GPX upload + render pipeline: `tour-form.vue` calls `parseGpxFile()` (`@tmcw/togeojson`) and stores the resulting GeoJSON inline as a JSONB column via the `create_tour_full` / `update_tour_full` RPCs. The map's `gpx-track-layer` reads `tour.gpxTrack` and renders a hardcoded orange polyline.

Issue #61 asks for: (1) move raw `.gpx` files into proper blob storage, (2) color the rendered track to match tour type, (3) cascade delete on remove/delete. Additional product constraints clarified by the user:

- **Forward-compatible RLS**: tours will gain sharing (specific friends) and public visibility. The Storage path layout chosen now must support that without re-keying objects later.
- **Track color must be a darker tone** than the tour marker, so track and marker remain visually distinct.
- **No GPX data in production yet** — atomic column flip, no dual-write, no backfill.
- **Download original** action in tour info sheet.

Other constraints: Supabase free tier; 2 MB client cap stays; no `console.log`; vue-i18n for all UI strings; ESLint zero-warnings.

## Goals / Non-Goals

**Goals:**
- Persist `.gpx` files in Supabase Storage with a path layout that survives the future shift from owner-only to shared/public RLS.
- Render selected tour's track in a darker variant of the tour-type color via MapLibre data-driven styling.
- Cascade delete: remove track or delete tour → Storage object gone.
- Single, responsive UX block in the tour form (upload / replace / remove) plus a download-original action in the info sheet.
- Maintain offline-friendly behaviour via PWA runtime cache.

**Non-Goals:**
- In-app GPX editing.
- Drawing new tracks on the map.
- Multi-track per tour.
- Server-side GPX simplification.
- Sharing/public-tour features themselves (only the *path layout* is forward-compatible).

## Decisions

### 1. Storage layout — tour-id-rooted, owner-agnostic
- Bucket: `tour-gpx`, **private**.
- Object key: `${tourId}.gpx` (flat). Tour ids are UUIDs → no collision.
- Why not `${userId}/${tourId}.gpx`: that locks the path to the original owner. Future "shared with friends" or "public" tours would still resolve auth via the `tours` row, not the path; encoding the owner in the path adds zero benefit and forces re-keying if ownership transfers ever appear.
- Why not `${visibility}/${tourId}.gpx`: would require object move when visibility changes — exactly the kind of migration we're trying to avoid.
- DB column: `tours.gpx_filepath text null` (nullable; null = no track). Stores the full object key.
- RLS resolves `${path}` → `tour_id := substring(name from '^(.*)\.gpx$')::uuid` → look up `tours` row → authorise. Today the rule is `tours.user_id = auth.uid()`. When sharing/public columns are added, the policy clause expands without touching paths.

### 2. Source-of-truth model
- Storage holds the `.gpx`. DB holds the path.
- Drop `gpx_track` JSONB column outright in the same migration. No dual-write, no backfill (no production rows exist).

### 3. Client fetch + parse
- On tour selection, gpx-track-layer reads `tour.gpxFilepath`, requests a signed URL (60 min TTL), downloads, parses with `parseGpxFile`.
- In-memory `Map<tourId, FeatureCollection>` LRU cache (max 10) avoids re-parsing on re-selection.
- PWA `StaleWhileRevalidate` runtime cache rule for the Storage origin keeps repeat loads instant offline.

### 4. Track color — darker than marker
- New constant `TOUR_TYPE_TRACK_COLORS` mirroring `TOUR_TYPE_COLORS` but with a darker variant per type. Computed once at module load via an HSL `darken(color, 18%)` helper (small util in `core/utils/color.ts`); committed as literal hex values for stability and easy review.
- Layer paint uses a `match` expression: `['match', ['get', 'tourType'], ...flatMap(TOUR_TYPE_TRACK_COLORS), <fallback>]`.
- `tourType` injected as a feature property at parse time before `setData`.
- Why darker (not lighter): the existing `TOUR_TYPE_PREVIEW_COLORS` is the lighter variant used for edit preview; tracks need visual hierarchy *below* the marker so they read as background lines, with the marker popping in front.
- Rejected alternative: client-side `darken()` via a layer expression. MapLibre style expressions cannot manipulate color components reliably across all renderers; literal map is simpler and deterministic.

### 5. RLS and policies (forward-compatible)
- Bucket policies on `storage.objects` for `tour-gpx`:
  - **Helper**: SQL function `tour_id_from_gpx_path(text) returns uuid` extracts the UUID from `${tourId}.gpx`.
  - **SELECT**: `EXISTS (SELECT 1 FROM tours t WHERE t.id = tour_id_from_gpx_path(name) AND t.user_id = auth.uid())`.
  - **INSERT/UPDATE/DELETE**: same predicate.
  - Future expansion: replace the predicate with `... AND (t.user_id = auth.uid() OR t.is_public OR EXISTS (SELECT 1 FROM tour_shares s WHERE s.tour_id = t.id AND s.user_id = auth.uid()))` — schema change only, no path change.
- DB trigger `AFTER DELETE ON tours` calls a SECURITY DEFINER function that issues `storage.objects` delete by name when `gpx_filepath` is non-null. Belt-and-suspenders cleanup if client crashes between row delete and storage delete.

### 6. Upload orchestration
- **Create flow**: parse → validate locally → call repo `create` (without filepath) → on success, upload `.gpx` to `${tourId}.gpx` → patch `gpx_filepath`. Tour ID required for key, hence two-step.
- **Edit flow with replace**: upload (overwrite same key) → no filepath patch needed (key unchanged).
- **Edit flow with remove**: delete object → patch `gpx_filepath = null`.
- Rejected alternative: client-generated UUID for object key before insert. Cleaner upload-first flow but loses the "key === tour id" invariant that simplifies RLS extraction.

### 7. UX (mobile + desktop)
- Reuse existing `tour-form.vue` GPX block. Replace native `<input type="file">` styling with the app's button design tokens. States:
  - Empty: outline button "Upload GPX track" with file picker.
  - Filled: filename chip + small `Replace` and `Remove` actions; small color swatch matching the (darker) track color.
  - Uploading: button disabled with inline spinner, text "Uploading…".
  - Error: inline error using existing `gpxError` slot, `--color-error`.
- `tour-info-sheet.vue` adds a `Download GPX` action when `gpxFilepath` is set: opens signed URL and triggers a download with the original filename (stored as Storage object metadata `originalName` at upload time, falls back to `${tour.name}.gpx`).
- Layout already adapts via `adaptive-overlay` (bottom-sheet on mobile, dialog on desktop). Tap targets ≥44 px; rows stack on narrow viewports via existing form styles.

### 8. Visibility transitions & revocation (forward-looking)

This change ships with private-only tours, but the storage layout and RLS shape are picked so the future shared/public model needs **only a policy diff** — no path change, no file move, no re-upload.

**Future schema (illustrative, not part of this change):**
- `tours.visibility enum('private','shared','public') default 'private'`
- `tour_shares(tour_id uuid, user_id uuid, primary key (tour_id, user_id))`

**Future SELECT policy on `storage.objects` for `tour-gpx`:**

```sql
EXISTS (
  SELECT 1 FROM tours t
  WHERE t.id = tour_id_from_gpx_path(name)
    AND (
      t.user_id = auth.uid()
      OR t.visibility = 'public'
      OR (t.visibility = 'shared'
          AND EXISTS (SELECT 1 FROM tour_shares s
                      WHERE s.tour_id = t.id AND s.user_id = auth.uid()))
    )
)
```

INSERT/UPDATE/DELETE remain owner-only.

**Visibility transitions** are pure DB writes on the `tours` row (and `tour_shares` table). The Storage object is never touched.

| Transition | DB operation | Effect on new fetches |
|---|---|---|
| private → shared | insert `tour_shares` rows | recipients pass RLS immediately |
| private → public | `tours.visibility = 'public'` | anyone matching public clause passes immediately |
| shared → private | delete `tour_shares` rows or flip visibility | new requests denied — see revocation caveat |
| public → private | `tours.visibility = 'private'` | new requests denied — see revocation caveat |
| shared → public / reverse | column flip + share-table edits as needed | immediate |

**Revocation caveat — signed URLs bypass RLS until expiry.** Supabase signed URLs are pre-signed tokens: once issued, they remain valid for the full TTL even if the underlying RLS predicate would now deny. So a viewer who fetched a signed URL while a tour was public retains read access until that URL expires, even after the tour is flipped to private.

Mitigations, in increasing cost:
1. **Short TTL** — current design uses 60 min. Acceptable for recreational GPX (low-sensitivity).
2. **Shorter TTL on demand** — drop to ~5 min when stronger revocation matters.
3. **Edge Function proxy** that re-evaluates RLS on every request and streams the object. Instant revocation, higher latency and cost. Add only if a real revocation requirement appears.
4. **Path rotation** (rename object with a nonce on demote) to invalidate outstanding URLs. Sacrifices the "stable path" property; only justified by a hard revocation requirement.

**Out of scope of RLS entirely:** browser/PWA caches and disk copies of bytes already served. RLS cannot revoke data already on a viewer's device. Don't treat GPX confidentiality as a hard guarantee post-fetch.

**Anonymous (logged-out) public access**, if required, will need the SELECT policy to grant the `anon` role too. The path layout does not constrain that decision.

**Implication for this change**: nothing extra to build now. The forward-compat contract is captured in:
- Path layout: `${tourId}.gpx` (no owner / visibility encoded).
- Helper function `tour_id_from_gpx_path(text) returns uuid`.
- Single-table predicate shape that future visibility clauses can extend.
- 60 min signed-URL TTL — revisit when sharing ships.

## Risks / Trade-offs

- **Two-step create (insert tour → upload file)** → orphan rows possible if user closes tab mid-upload. Mitigation: on next open the empty `gpx_filepath` is just "no track"; user can retry. Acceptable.
- **Signed URL latency on every selection** → perceptible delay. Mitigation: in-memory + PWA cache; spinner in info sheet.
- **Storage egress on free tier** → repeated loads of large tracks. Mitigation: caching above; 2 MB cap.
- **RLS predicate cost** → every Storage access does a `tours` lookup. Mitigation: indexed PK lookup, negligible. Reassess if storage becomes a hot path.
- **Track color regression** → tracks of unknown tour types render fallback. Mitigation: explicit fallback; unit test asserts expression covers every `TOUR_TYPE_TRACK_COLORS` key.

## Migration Plan

1. Single DB migration: drop `gpx_track`, add `gpx_filepath`, create bucket, create RLS helper function + policies, create delete trigger, update RPCs.
2. Ship frontend in same release.
3. Rollback: drop the new column / trigger / policies / bucket; revert frontend. No data loss since no GPX data exists yet.

## Open Questions

- Confirm Supabase plan supports SECURITY DEFINER function calling `storage.delete_object` from a row trigger (free tier: yes).
- Should the download button include a Strava/Garmin "open with" share sheet on mobile? Out of scope; defer.
