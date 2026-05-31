## 1. Git Setup

- [x] 1.1 Stay on current branch `feat/85-friend-tour-visibility` — no new branch needed; changes build on top of the existing work

## 2. Database migration

- [x] 2.1 Generate migration file: `supabase migration new tour_links`
- [x] 2.2 Define `tour_link_group(id uuid pk default gen_random_uuid(), created_at timestamptz not null default now())`
- [x] 2.3 Define `tour_link_member(group_id uuid not null references tour_link_group(id) on delete cascade, tour_id uuid not null references tours(id) on delete cascade, joined_at timestamptz not null default now(), primary key (group_id, tour_id), unique (tour_id))`
- [x] 2.4 Define `tour_link_request(id uuid pk default gen_random_uuid(), initiator_tour_id uuid not null references tours(id) on delete cascade, target_tour_id uuid not null references tours(id) on delete cascade, status text not null check (status in ('pending','accepted','declined','withdrawn')) default 'pending', created_at timestamptz not null default now(), resolved_at timestamptz, check (initiator_tour_id <> target_tour_id))`
- [x] 2.5 Add partial unique index: `create unique index tour_link_request_one_pending on tour_link_request(initiator_tour_id, target_tour_id) where status = 'pending'`
- [x] 2.6 Enable RLS on all three tables
- [x] 2.7 RLS `tour_link_group`: SELECT policy — current user owns at least one tour in any member row of this group; no client INSERT/UPDATE/DELETE
- [x] 2.8 RLS `tour_link_member`: SELECT policy mirroring 2.7; no client INSERT/UPDATE/DELETE (mutations happen exclusively via SECURITY DEFINER functions)
- [x] 2.9 RLS `tour_link_request`: SELECT if user owns either referenced tour; no client INSERT/UPDATE/DELETE (mutations via RPCs only)
- [x] 2.10 Shared SQL function `fn_collision_predicate(tour_a_id uuid, tour_b_id uuid) RETURNS bool` — single source of truth for the collision predicate (PostGIS `ST_DWithin` ≤ 200 m, both non-null matching `tour_type`, both `visibility = 'friends'`, friendship row exists either direction, ids distinct)
- [x] 2.11 SECURITY DEFINER function `create_link_request(p_target_tour_id uuid, p_initiator_tour_id uuid) RETURNS uuid` — verify caller owns initiator; verify `fn_collision_predicate`; verify group-merge rule (at most one side already in multi-tour group); INSERT pending row; return request id; raise named errors for predicate / merge violations
- [x] 2.12 SECURITY DEFINER function `accept_link_request(p_request_id uuid) RETURNS jsonb` — verify caller owns target; re-verify predicate + group-merge rule; UPDATE request to `accepted` + `resolved_at`; resolve or create group; INSERT member row(s); return `{group_id, added_tour_ids}`
- [x] 2.13 SECURITY DEFINER function `decline_link_request(p_request_id uuid) RETURNS void` — verify caller owns target; UPDATE request to `declined` + `resolved_at`
- [x] 2.14 SECURITY DEFINER function `withdraw_link_request(p_request_id uuid) RETURNS void` — verify caller owns initiator; UPDATE request to `withdrawn` + `resolved_at`
- [x] 2.15 GRANT EXECUTE on the four RPCs to `authenticated`
- [x] 2.16 Trigger function `fn_evict_member_on_tour_change()`: AFTER UPDATE on `tours` — if `tour_type` changed, evict; if `visibility` changed away from `friends`, evict; if `goal` changed and the new goal is >200 m from any sibling member's goal, evict
- [x] 2.17 Trigger function `fn_evict_on_friendship_delete()`: AFTER DELETE on `friendships` — for every group containing tours owned by both broken-pair users, evict both users' tours (binary friendships table — no UPDATE branch needed)
- [x] 2.18 Trigger function `fn_void_pending_requests_on_invariant_break()`: invoked from both eviction triggers — set status to `withdrawn` and `resolved_at = now()` for every `pending` request involving an affected tour or broken friendship pair
- [x] 2.19 Trigger function `fn_dissolve_when_below_two()`: AFTER DELETE on `tour_link_member` — if the affected group now has fewer than 2 member rows, delete the group
- [x] 2.20 Wire the triggers to their tables
- [x] 2.21 Verify locally: `supabase db reset`, then exercise each trigger + RPC via SQL fixtures in the migration test or a temporary script
- [x] 2.22 Document migration in commit message; do NOT push to prod yet (deploy step prompted later)

## 3. Worker (`services/email-hook`)

- [x] 3.1 Rewrite `handleTourInterest` in `services/email-hook/src/notify.ts` to take a saved tour id, scan for friend-owned tours via `fn_collision_predicate` (or equivalent server-side SQL using the same `ST_DWithin` + friendship + visibility + type predicate), and dispatch a `tour_interest` notification per collision; authorize by verifying the caller's JWT subject equals the saved tour's `user_id`
- [x] 3.2 Extend `handleFriendRequestResponded` with an independent sub-routine `dispatchBackfillDigest`: when the response is accept, scan both sides for not-yet-linked, no-pending-request collisions, dispatch one digest `tour_interest` notification per side with payload `{friendshipId, collisionCount, appUrl}` deeplinking to the backfill collisions page. Each sub-routine is wrapped in independent try/catch so failure of one cannot block the other.
- [x] 3.3 Add `handleLinkRequestEvent`: takes `{requestId, event}` where `event ∈ {created, accepted, declined}`; authorizes the caller per the link-request RPC's actor rules; dispatches a `tour_interest` notification to the relevant counterparty. Withdraw events SHALL NOT trigger notification dispatch.
- [x] 3.4 Add `handleGroupMembershipEvent`: takes `{groupId, event, actorTourId, affectedTourId}` where `event ∈ {joined, evicted_external, dissolved}`; resolves recipients per the group-membership-change notification scenarios (joined → pre-existing members; evicted_external → evicted user + remaining members; dissolved → lone remaining member); dispatches `tour_interest` notifications honoring mute prefs; self-eviction (own confirmed edit) suppresses the self-notify
- [x] 3.5 Update Brevo templates `tour_interest_en` / `tour_interest_de` copy to cover all trigger paths (post-save collision; request created/accepted/declined; group joined/evicted/dissolved; friendship-backfill digest); reuse existing template ids with new parameter variants
- [x] 3.6 Update `services/email-hook/SETUP-NOTIFICATIONS.md` to describe new endpoints, payloads, and template parameter variants
- [x] 3.7 Add unit tests in the Worker package covering authorization rejection paths, the collision scan SQL shape, and the independent failure isolation between `dispatchRespondedNotification` and `dispatchBackfillDigest`

## 4. Frontend domain + data layer

- [x] 4.1 Extend `src/features/tours/domain/collision.ts` collision predicate to include `tour_type` equality (skipping nulls), friends-visibility on both sides, and accepted-friendship between owners; export a single function reused by every client surface
- [x] 4.2 Create new feature module `src/features/tour-links/` with subdirectories `data/{models,repositories,services}`, `domain/{entities,repositories}`, `presentation/{stores,pages,components}`
- [x] 4.3 Zod schemas for `tour_link_group`, `tour_link_member`, `tour_link_request` in `data/models/`
- [x] 4.4 Domain entities and repository interfaces in `domain/`
- [x] 4.5 Supabase repository impl in `data/repositories/` with methods: `listGroupsForTours(tourIds)`, `listPendingRequestsForTours(tourIds)`, `createRequest(initiatorTourId, targetTourId)` (calls `create_link_request` RPC), `acceptRequest(requestId)` (RPC), `declineRequest(requestId)` (RPC), `withdrawRequest(requestId)` (RPC), `listBackfillCollisionsForFriendship(friendshipId)`
- [x] 4.6 Pinia store `tour-links-store.ts` in `presentation/stores/` exposing `loading`, `error`, `groupsByTourId`, `requestsByTourId`; subscribes via Supabase Realtime to `tour_link_request` only (handshake feedback); refetches `tour_link_member` lazily on tour info-sheet open and on tour-list mount

## 5. Frontend presentation: tour info-sheet integration

- [x] 5.1 Component `linked-with-section.vue` — renders a "Linked with" section header above a row of bare-name pills (one per sibling group member); pill click navigates to that tour via the existing tour-detail route; first two pills inline, remaining collapsed into a "+N more" pill that opens an overflow list (desktop dialog / mobile bottom sheet) of all linked friends with per-row navigation
- [x] 5.2 Component `collision-notice.vue` — info notice with friend names and a per-counterpart "Request to link" button; shown only when there is at least one not-yet-linked colliding friend tour
- [x] 5.3 Component `link-request-banner.vue` — banner with accept/decline (incoming) or withdraw (outgoing) actions; one banner per pending request
- [x] 5.4 Component `link-edit-warning-dialog.vue` — confirmation dialog matching the existing friendship/contact delete-dialog design language, fired before submitting an edit that would evict from a group (goal across boundary, type change, visibility flip)
- [x] 5.5 Integrate the four components into the tour info-sheet template, gated by `tour-links-store` state
- [x] 5.6 Hook the edit-warning dialog into the tour edit flow in `features/tours/presentation/components/` so it intercepts submits for linked tours when the change is eviction-causing
- [x] 5.7 Extend the existing tour-delete confirmation dialog with conditional copy "This tour is linked with [N] friend tour(s). Deleting will unlink them." rendered only when the target tour belongs to a `tour_link_group`
- [x] 5.8 Add a "Collisions ([N])" entry on the friend profile page in `src/features/friendships/presentation/` that opens `backfill-collisions-page` filtered to that friendship; visible regardless of the viewing user's `tour_interest` mute preference
- [x] 5.9 Add the chain/link icon overlay to map markers in `src/features/map/presentation/components/` for any rendered marker whose tour belongs to a `tour_link_member` row; preserve existing owned-over-friend collision-suppression precedence and clustering behavior

## 6. Frontend presentation: backfill page

- [x] 6.1 Component `backfill-collisions-page.vue` in `src/features/tour-links/presentation/pages/` — list of `[your tour] ⇄ [friend's tour]` rows with per-row "Request to link" action; empty-state when scan returns no pairs
- [x] 6.2 Register the page in `src/app/router/index.ts` under a path like `/friends/:friendshipId/backfill-collisions`, behind the existing auth guard
- [x] 6.3 Ensure the digest notification deeplink (from Worker payload) opens this route correctly via the existing notification-click handler

## 7. Frontend: remove legacy flow

- [x] 7.1 Delete `src/features/tours/presentation/components/duplicate-tour-dialog.vue` and all imports
- [x] 7.2 Remove `pendingDuplicate`, `handleDuplicateConfirm`, `handleDuplicateDecline`, `handleDuplicateCancel`, and the colliding-tour gate in `src/features/map/presentation/pages/map-page.vue`; ensure saves proceed unconditionally
- [x] 7.3 Update `notifyTourInterest` in `src/features/notifications/data/notify-dispatch.ts` to be called after every successful tour create/update (collision scan trigger) — comments and signature reflect the new semantics
- [x] 7.4 Add `notifyTourLinkRequestEvent(requestId, event)` and `notifyGroupMembershipEvent(groupId, event, ...)` dispatch helpers; wire them into the `tour-links-store` mutations and the eviction-causing edit/delete flows respectively. The friendship-accept backfill digest does NOT need a separate client helper — it is folded into the existing `notifyFriendRequestResponded` call (Worker handles both sub-routines)
- [x] 7.5 Confirm the tour-list view, friend-tours map layer, and any other surface previously gated by `findCollidingPartnerTour` still behaves correctly (now without the duplicate prompt branch)

## 8. Frontend: notifications preferences label

- [x] 8.1 Reword the `tour_interest` mute toggle label and description in `notification-preferences-section.vue` to communicate "same-tour collaboration suggestions" (collision, link-request events, backfill digest)
- [x] 8.2 Add the new i18n keys to `src/locales/en.json` and `src/locales/de-CH.json`; keep the `'tour_interest'` enum value unchanged in code and DB

## 9. i18n

- [x] 9.1 Add all new user-facing strings (pill labels, notice text, banner labels, dialog copy, backfill page strings, preference label/description) to `src/locales/en.json` and `src/locales/de-CH.json` under appropriate namespaced keys (`tourLinks.*`, `tours.infoSheet.*`, `notifications.preferences.tourInterest.*`)

## 10. Tests (Vitest, edge cases per `.claude/testing.md`)

- [x] 10.1 Collision predicate unit tests: null tour_type, exactly 200 m boundary, different tour_type, one side private, non-friend owner
- [x] 10.2 Link request RPC tests: `create_link_request` rejects when predicate fails; `create_link_request` rejects when both sides already in multi-tour groups (merge forbidden); duplicate pending rejected; declined / withdrawn request can be re-created; `accept_link_request` rejected when caller does not own target; `withdraw_link_request` rejected when caller does not own initiator; one-existing-member-accept admits a third tour to an existing 2-member group without re-prompting other members
- [x] 10.3 Eviction trigger tests via SQL fixtures: goal nudge across 200 m boundary, type change, visibility flip to private, friendship deletion in a 3-member group (entire group dissolves per accepted semantic), friendship deletion in a 4-member group (broken-pair owners both evicted, remaining still-friends pair survives), dissolution when count drops below 2; stale pending requests auto-resolve to `withdrawn` when their underlying collision evaporates
- [x] 10.4 Backfill scan tests: deduplicates collisions, excludes already-linked pairs, excludes pending-request pairs, returns empty when no eligible collisions
- [x] 10.5 Store tests: `tour-links-store` reactive updates on request status changes, request withdrawal, group membership changes
- [x] 10.6 Component tests: linked-with section renders first two pills inline + "+N more" when group size > 3; "+N more" tap opens overflow list (desktop dialog / mobile bottom sheet); banner action wiring; edit-warning dialog cancellation aborts the submit; delete dialog renders link copy only when target tour is grouped; friend-profile collisions entry visible regardless of mute prefs
- [x] 10.7 Run `npm run test` — all green

## 11. Finalize

- [x] 11.1 Run `npx eslint . --fix` and resolve remaining warnings; confirm zero warnings as enforced by CI
- [x] 11.2 Run `npm run type-check`
- [x] 11.3 Run `npm run test` once more
- [x] 11.4 Prompt user to push to prod DB: `supabase db push` (do NOT run unprompted)
- [x] 11.5 Prompt user to commit with the following ready-to-copy conventional commit message group (split into atomic commits as appropriate):
  - `feat(tour-links): add N-way tour link groups with handshake and triggers`
  - `feat(notifications): collision-detected scan and friendship-accept backfill digest`
  - `refactor(tours): remove duplicate-save dialog and decline-interest branch`
  - `feat(i18n): add tour-links and reworded tour-interest strings`
- [x] 11.6 Prompt user to push the branch and open a PR against `main` with a description summarizing the proposal's "What Changes" section and linking to the OpenSpec change directory

## 12. Fix: pending-request invalidation on tour edit (Issue 1)

- [x] 12.1 New migration `supabase migration new void_pending_requests_on_predicate_break` — trigger `fn_void_pending_requests_on_tour_change()` AFTER UPDATE on `tours`, fires when `goal`, `tour_type`, or `visibility` changed; for each `pending` row in `tour_link_request` where the updated tour is `initiator_tour_id` or `target_tour_id`, re-evaluate `fn_collision_predicate(initiator_tour_id, target_tour_id)`; rows where the predicate is now false UPDATE to status `withdrawn`, `resolved_at = now()`. Idempotent with the existing eviction-driven void function (same set semantics — re-running cannot re-open a withdrawn row).
- [x] 12.2 SQL fixture tests: (a) goal nudge breaks pending outgoing request → row becomes `withdrawn`; (b) tour_type change on initiator with pending request → withdrawn; (c) visibility flip to private on target with pending request → withdrawn; (d) tiny goal nudge inside the radius does NOT withdraw; (e) edit that leaves predicate true → request stays `pending`.
- [x] 12.3 Extend client gate in `src/features/tours/presentation/components/tour-info-sheet.vue`: rename `wouldEvict` → `wouldBreakLink`; add branch for outgoing/incoming pending requests using the existing client-side collision predicate (mirror the server `fn_collision_predicate`); read pending requests from `tour-links-store.requestsByTourId`. Gate fires when either (a) tour is grouped AND existing eviction conditions hold, OR (b) any pending request involves this tour AND the predicate would become false for it.
- [x] 12.4 Adapt `link-edit-warning-dialog.vue` copy: when target tour is grouped, keep current "this will unlink" copy; when only pending requests are affected (no group), use new i18n key `tourLinks.editWarning.pendingBody` ("This change will cancel your pending link request(s)."). Add keys to `src/locales/en.json` and `src/locales/de-CH.json`.
- [x] 12.5 Notification policy: NO client dispatch for trigger-driven auto-withdrawals (matches current `withdrawn` policy in Task 3.3). Document in `services/email-hook/SETUP-NOTIFICATIONS.md` that `withdrawn` is silent regardless of cause; if the policy changes later, auto-withdrawal inherits.
- [x] 12.6 Vitest: extend `tour-info-sheet` component tests for the new pending-request branch of the warning dialog; extend `tour-links-store` tests for the realtime status flip from `pending` → `withdrawn` triggered server-side.

## 13. Fix: in-app backfill entry from Friends tab + tab persistence (Issue 2)

- [x] 13.1 Repository: add `listAllBackfillCollisions()` to `src/features/tour-links/data/repositories/tour-links-repository-impl.ts` — scans every accepted friendship of the viewer and returns deduplicated pairs (excluding already-linked and pending-request pairs); each pair carries a `friendName` field for display. Add SQL via a new SECURITY DEFINER function `list_all_backfill_collisions()` returning the pair set, OR compose via existing `listBackfillCollisionsForFriendship` per friendship if performance allows for the expected friend counts (decide during impl based on local-DB query plan).
- [x] 13.2 Add Pinia store method `loadAllBackfillCollisions()` if needed for caching; otherwise call repo directly from the page.
- [x] 13.3 Generalize `backfill-collisions-page.vue` to support two modes: `friendship` (existing, via `route.params.friendshipId`) and `all` (new, via prop `mode="all"`). In `all` mode, render the `friendName` column. Empty state copy adapts per mode.
- [x] 13.4 Add entry button in `src/features/tours/presentation/components/tour-list-sheet.vue` Friends tab: above the search row, render a `BackfillEntryButton` (or inline `<button>`) labeled `tours.list.viewBackfillCollisionsBtn`; clicking sets a local `view = 'backfill'` ref that swaps the sheet body to a `<BackfillCollisionsPage mode="all" @back="view = 'list'">`. The component is shared between the route-driven page and the embedded use — refactor `backfill-collisions-page.vue` to accept an `emit('back')` and fall back to `router.back()` when no listener is attached.
- [x] 13.5 Hide the entry button when the user has zero accepted friendships (use `friendshipsStore`); show even when `friendTours` is empty (collisions may exist without the friend having tours visible yet — though predicate requires visibility, so practical case is the user just opening the surface).
- [x] 13.6 Persist active tab across sessions: extend `useActiveTourTab` in `src/features/tours/presentation/composables/use-tour-filters.ts` to read initial value from `localStorage['tours.list.activeTab']` (validate against `TourTab` union, fall back to `'owned'`), and `watch` the ref to write back on change. Wrap localStorage calls in try/catch for safe-mode browsers.
- [x] 13.7 i18n: add `tours.list.viewBackfillCollisionsBtn`, `tourLinks.backfillAllEmpty`, and any `friendName` column header keys to `src/locales/en.json` and `src/locales/de-CH.json`.
- [x] 13.8 Vitest: tab persistence (initial read from localStorage, write on change, falls back on invalid value); list-sheet test that the button is hidden with zero friendships; embedded backfill page emits `back` instead of routing when the embedded prop is set.
- [x] 13.9 Manual test (mobile + desktop): verify bottom sheet on mobile, side drawer on desktop; tap entry button, see pairs across all friendships, request link removes the pair, back button returns to Friends tab with state preserved.

## 14. Finalize (re-run after sections 12 and 13)

- [x] 14.1 `npx eslint . --fix` — zero warnings
- [x] 14.2 `npm run type-check`
- [x] 14.3 `npm run test`
- [x] 14.4 Update `MANUAL_TEST_CASES.md` with cases for Issue 1 (edit linked-but-pending tour off-collision → warning shown; confirm → pending request withdrawn; accept from counterpart side after → row no longer present) and Issue 2 (Friends tab entry; back navigation restores Friends tab; tab persists across reload).
- [ ] 14.5 Prompt user to push DB migration: `supabase db push`
- [ ] 14.6 Prompt user to commit with conventional commit messages:
  - `fix(tour-links): auto-withdraw pending requests when edit breaks collision predicate`
  - `feat(tour-links): in-app backfill entry on friends tab, persist last active tab`
