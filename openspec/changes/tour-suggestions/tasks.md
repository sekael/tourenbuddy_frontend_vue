## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/268-tour-suggestions`

## 2. Database — table, view, RLS, trigger (local first, never prod)

- [x] 2.1 `supabase start`, then `supabase migration new tour_suggestions` — ONE new file; never edit an existing migration
- [x] 2.2 In that file: `create table public.tour_suggestion (...)` per design D1 — including `owner_id` (D8) and `target_id` (D3), with CHECK constraints on the `field` and `status` enums
- [x] 2.3 Same file: `grant all on table public.tour_suggestion to anon, authenticated, service_role;` — MANDATORY for every new public table (Data API exposure)
- [x] 2.4 Same file: the partial unique index of D13 — `(tour_id, suggester_id, field, coalesce(target_id, '000…0'::uuid)) where status = 'pending'` — plus indexes on `(tour_id, status)`, `(owner_id)`, `(suggester_id)`, `(batch_id)`
- [x] 2.5 Same file: enable RLS. SELECT policy `owner_id = auth.uid() or suggester_id = auth.uid()` (D8). NO insert/update/delete policies at all — every mutation goes through a definer RPC, so their absence IS the block
- [x] 2.6 Same file: `tour_field_value(p_tour_id uuid, p_field text) returns jsonb` (D4) — the ONLY place a field is serialized to jsonb. Used to write `base_value`, to evaluate staleness, and by the diff on resubmit
- [x] 2.7 Same file: `tour_suggestion_view` (security_invoker) exposing every column plus `is_stale = tour_field_value(tour_id, field) is distinct from base_value`. This is the client's ONLY read surface for suggestions — the client never compares values itself
- [x] 2.8 Same file: `AFTER` trigger voiding pending suggestions when the partner predicate breaks (D11) — model on `20260530120000_void_pending_requests_on_predicate_break.sql`. Fires on `tours` update (visibility → private, partner set change), `friendships` delete, `contact_methods` delete. Sets `status = 'withdrawn'`, `resolved_at = now()`. Voiding is silent — no dispatch (D16)
- [x] 2.9 Same file: add `tour_suggestion` to the realtime publication, mirroring `20260528190811_tour_links_realtime_and_autoresolve.sql`

## 3. Database — the RPCs

- [x] 3.1 `upsert_tour_suggestions(p_tour_id uuid, p_batch_id uuid, p_items jsonb)` SECURITY DEFINER (D12 — handles BOTH first submit and revision). Validates: caller ≠ owner; tour is `friends`-visible; accepted friendship; `auth.uid() = any(public.tour_partner_user_ids(p_tour_id))`. Reconciles the caller's PENDING set: update-in-place with refreshed `base_value`, insert new fields into the same batch, withdraw reverted fields. `on conflict` targets 2.4's index so a retried submit is idempotent. `base_value` always comes from `tour_field_value` server-side — NEVER trust a client-supplied base. Named errors only
- [x] 3.2 `accept_tour_suggestion(p_id uuid, p_storage_path text default null)`. Owner-only, with an EXPLICIT owner gate (SECURITY DEFINER bypasses RLS — that gate is the only one; write it as `update_tour_full:127` does). Re-checks partner status and `status = 'pending'`. Applies via a targeted `update public.tours set … where id = …` selected by a `CASE` on `field` (D5) — NOT `update_tour_full`, which is a full-row overwrite that would null omitted columns and churn `tour_partners`. Then auto-declines every other pending row with the same `(tour_id, field, target_id)` (D7)
- [x] 3.3 `accept_tour_suggestion_batch(p_batch_id uuid)` — owner-only, ONE transaction, applying in the fixed order **removes → scalars → adds** with the attachment cap evaluated on the END state (D10). One `updated_at` bump, one broadcast, one `tour_updates` dispatch
- [x] 3.4 `decline_tour_suggestion(p_id uuid)` (owner-only) and `withdraw_tour_suggestion(p_id uuid)` (author-only, pending-only). Both set `resolved_at`; neither touches the tour
- [x] 3.5 Every resolving RPC returns whether the affected batch is now fully resolved, so the client knows whether to dispatch the completion notification (D16)
- [x] 3.6 `grant execute … to authenticated, service_role` for all five functions and `tour_field_value`
- [x] 3.7 Storage: SELECT policy on `storage.objects` letting the tour OWNER read objects under `<suggester>/suggestions/<tour_id>/…` referenced by a PENDING suggestion on their tour, for BOTH `tour-gpx` and `tour-attachments` (D9). Add NO insert policy — the suggester writes under their own uid prefix, already permitted by the existing owner-insert policy
- [x] 3.8 `supabase db reset` — clean run from scratch, no errors
- [ ] 3.9 `supabase/tests/tour_suggestion_rls.sql`, mirroring `friend_tour_visibility_rls.sql`: non-partner create rejected; direct INSERT rejected; author cannot accept; owner cannot withdraw; non-author cannot revise; third partner reads zero rows; predicate break voids pending; duplicate pending row rejected by the unique index. Script written; NOT yet run — run it against the local DB

## 4. Domain + data layer

- [x] 4.1 `src/features/tours/data/models/tour-suggestion.ts` — Zod: `suggestionFieldSchema` (the 14-value enum, D2), `suggestionStatusSchema`, `tourSuggestionRowSchema` with a snake→camel transform mirroring `tour-schema.ts`, including `isStale`. Export `SUGGESTABLE_FIELDS`
- [x] 4.2 `test/features/tours/data/models/tour-suggestion.test.ts` — assert the Zod enum matches the SQL CHECK enum verbatim by reading the migration file, so drift between the two copies fails CI (D2)
- [x] 4.3 `src/features/tours/domain/entities/tour-suggestion.ts` — `TourSuggestion`, `SuggestionBatch` (author + rows), `SuggestionField`
- [x] 4.4 `src/features/tours/domain/repositories/tour-suggestions-repository.ts` — abstract interface: `listForUser`, `upsertBatch`, `accept`, `acceptBatch`, `decline`, `withdraw`
- [x] 4.5 `src/features/tours/data/repositories/tour-suggestions-repository-impl.ts` — Supabase impl over `tour_suggestion_view` + the five RPCs. Staged-blob upload and the accept-time `storage.from(bucket).copy(staged, ownPath)` live here (D9)

## 5. Suggestion diff — **your gap**

- [x] 5.1 `src/features/tours/presentation/composables/use-suggestion-diff.ts` — implement the function marked `// TODO(me):`. Original `Tour` + submitted `TourDraft` → one suggestion item per CHANGED logical field, per D2: coupled columns emit as a single item; a moved goal emits `goal` carrying its looked-up elevation and NO standalone `elevation`; elevation edited alone emits `elevation`; unchanged fields emit nothing; an explicit clear emits an item with a null value rather than no item; the partner set, visibility and completion are never emitted. See the task list at the end of the response
- [x] 5.2 `test/features/tours/presentation/composables/use-suggestion-diff.test.ts` — edge cases only: nothing changed → empty; only `end_date` changed → ONE `dates` item carrying both dates; description cleared → item with null value, not omitted; goal moved → ONE `goal` item carrying elevation, no `elevation` item; elevation edited alone → `elevation` only; start point moved → one `start_point` item with coords + name + elevation; `completed` / `visibility` / partner set flipped → never emitted

## 6. Store

- [x] 6.1 `src/features/tours/presentation/stores/tour-suggestions-store.ts` — composition store with `loading` / `error` / `suggestions` refs. ONE load query for all rows where `owner_id = uid or suggester_id = uid` (D15), through `cachedLoad` for offline hydration (D14). Derive `pendingCountByTour`
- [x] 6.2 Same file: actions gate on the `isOnline` signal and surface the offline message; they do NOT call `mutate()` with a queue spec (D6 — online-only)
- [x] 6.3 Same file: `useRealtimeSubscription` with BOTH bindings — `owner_id=eq.<uid>` and `suggester_id=eq.<uid>` — on one channel key, and an `onSubscribed` doing a FULL refetch (D8; a hidden tab tears the channel down and drops events)
- [x] 6.4 Same file: notification dispatch on success only, never from `onChange` (architecture rule). Owner on submit; author only when the RPC reports the batch fully resolved (D16); `notifyTourChanged` to the other partners on a meaningful accept, excluding actor and author
- [x] 6.5 Same file: sweep staged storage objects belonging to the caller's OWN resolved suggestions on load (D9 — only the author holds delete rights on their prefix)
- [x] 6.6 `test/features/tours/presentation/stores/tour-suggestions-store.test.ts` — failure cases: offline submit blocked and nothing queued; RPC named error surfaces to `error`; accept on an already-resolved row; partial batch resolution dispatches NO author notification; `onSubscribed` refetches

## 7. UI — suggest mode

- [x] 7.1 `tour-form.vue` — add a `mode?: 'edit' | 'suggest'` prop. In suggest mode hide the visibility, completion and partner controls, relabel submit, and seed from the friend tour — or, when revising, from the author's own pending values (D12). Keep the diff logic OUT of the SFC (already 1263 lines)
- [x] 7.2 Suggest mode re-runs the existing Swisstopo elevation/name services on a moved goal or start/end point, so the bundled items carry derived values (D2)
- [x] 7.3 `tour-info-sheet.vue` — on a friend tour where `isPartner`, a "Suggest changes" action; on an owned tour, the pending-count indicator opening the review sheet, plus the history entry (D15)
- [x] 7.4 `tour-list-row.vue` — pending indicator on owned tours, fed by `pendingCountByTour` (D15)
- [x] 7.5 Staged upload path for `gpx` / `attachment_add` in suggest mode: `<uid>/suggestions/<tourId>/<uuid>` (D9). Reuse the existing picker validation (mime, 10 MB, HEIC message) — do not duplicate it

## 8. UI — review + history

- [x] 8.1 `tour-suggestion-row.vue` — one field row: label, original value, suggested value, actions. Stale rows render three columns (current / base / suggested) driven by `isStale` from the view (D4). Accept disabled with a hint when an `attachment_add` would breach the cap (D10)
- [x] 8.2 `tour-suggestion-review-sheet.vue` — ONE sheet, two modes: owner gets accept/decline + per-batch accept-all; author gets withdraw + revise (reopens suggest mode), and never accept/decline. Grouped by `batch_id` with the author name. Empty state
- [x] 8.3 `tour-suggestion-history-sheet.vue` — resolved rows with status, author and `resolved_at`
- [x] 8.4 Component tests, failure/edge only: stale row renders three columns; cap-full disables accept with the hint; accept-all failure leaves every row pending; author mode renders no accept action; empty state

## 9. Notifications

- [x] 9.1 `src/features/notifications/domain/entities/notification-preferences.ts` — add `tour_suggestions` to the union and the ordered list
- [x] 9.2 `notification-preferences-section.vue` — render the new row (label + description keys)
- [x] 9.3 `src/features/notifications/data/notify-dispatch.ts` — `notifyTourSuggestion(batchId, action)` for `'submitted' | 'resolved'`, fire-and-forget exactly like `notifyTourChanged`
- [x] 9.4 `services/email-hook/src/notify.ts` — `/notify/tour-suggestion` endpoint. Resolves the recipient from the suggestion rows via service role: owner for `submitted`, author for `resolved` (with accepted/declined counts). Honors `notif_push_enabled` / `notif_email_enabled` / `notif_muted_types` including the new type. One notification per batch
- [x] 9.5 `services/email-hook/src/email.ts` — widen the type union and add localized copy for both actions
- [ ] 9.6 **Deploy the Worker manually**: `cd services/email-hook && npx wrangler@latest deploy`. NOT in CI — without this the endpoint 404s and every suggestion notification silently no-ops

## 10. i18n

- [x] 10.1 Add every new key to BOTH `src/locales/en.json` and `src/locales/de-CH.json`: suggest-mode labels, per-logical-field labels, review sheet (owner + author modes), stale marker, accept/decline/withdraw/revise, cap error, history sheet, list indicator, offline message, and the `tour_suggestions` notification label + description. Check for existing keys before adding

## 11. Verification

- [x] 11.1 `npm run test` — all pass
- [x] 11.2 `npm run type-check` — clean
- [x] 11.3 `npx eslint . --fix` then `npx eslint` — zero warnings
- [ ] 11.4 Manual against the LOCAL Supabase, three accounts: partner suggests 3 fields + a photo → revises one field before the owner acts → owner sees one batch, accepts one, declines one, accept-alls the rest → tour reflects exactly the accepted values, `updated_at` advanced once per action, author gets ONE completion notification, third partner account sees only the original tour throughout and gets the `tour_updates` notification for the meaningful accept
- [ ] 11.5 Manual: swap test — on a tour holding 5 attachments, a batch with one remove + one add accepts cleanly (D10)

## 12. Finalize

- [x] 12.1 Run `npx eslint . --fix` (NEVER `npm run format`); do not touch CHANGELOG
- [ ] 12.2 Prompt the user to commit — ready-to-copy message:
      `feat(tours): partner suggestions on shared tours (#268)`
- [ ] 12.3 Prompt the user to push and open a PR against `main`, and to run `supabase db push` as an explicit, reviewed deploy step AFTER approval — never unprompted
- [ ] 12.4 Remind the user that step 9.6 (`wrangler deploy`) must happen for notifications to work in preview/prod
- [ ] 12.5 Prompt the user to archive this change with the openspec archive skill
