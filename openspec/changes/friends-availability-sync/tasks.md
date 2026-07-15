## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/244-friends-availability-sync`

## 2. Database (migrations — local-first, new files only)

- [x] 2.1 `supabase migration new friend_availability_access_and_realtime` — in the generated file: additive `user_availability_select_friend` RLS policy (accepted-friendship `exists` between `auth.uid()` and `user_availability.user_id`), mirroring `tours_select_friend`
- [x] 2.2 Same migration: `alter publication supabase_realtime add table public.user_availability` (enables own `postgres_changes` multi-device sync)
- [x] 2.3 Same migration: `fn_broadcast_availability_change()` (`security definer`, `set search_path = ''`) — statement-level; read changed rows via transition table, `select distinct user_id`, guard `if exists`; for each changed user loop that user's accepted friends; `realtime.send('refetch', 'availability:'||friend_id, private)`. Mirror `fn_broadcast_friend_tour_change` but `FOR EACH STATEMENT` + transition tables (multi-row diff, no `auth.uid()` dependency)
- [x] 2.4 Same migration: two triggers (`AFTER INSERT ... REFERENCING NEW TABLE AS changed` and `AFTER DELETE ... REFERENCING OLD TABLE AS changed`) `FOR EACH STATEMENT EXECUTE FUNCTION fn_broadcast_availability_change()` — a single trigger can't reference both NEW and OLD transition tables
- [x] 2.5 Same migration: realtime `messages` RLS policy authorizing a user to read their own `availability:<uid>` topic (mirror `friend_tours_realtime_messages_policy`)
- [x] 2.6 Apply + verify locally: `supabase db reset`, then `supabase stop && supabase start` (publication changes do NOT stream until a full stack restart)
- [x] 2.7 Manually verify with two local users: friend A reads B's rows (RLS), non-friend reads none, A cannot write B's rows, B's save pings A's `availability:<A>` topic

## 3. Data layer

- [x] 3.1 Add `listFriendsFrom(fromDate: string): Promise<AvailabilityRow[]>` to `AvailabilityRepository` (domain interface)
- [x] 3.2 Implement in `SupabaseAvailabilityRepository`: `select user_id, date from user_availability where date >= from and user_id <> <me>`, parse via `availabilityRowSchema`

## 4. Store (`availability-store`)

- [x] 4.1 Add friend-availability state (`friendDays: Ref<AvailabilityRow[]>` or `Map<dayKey, userId[]>`) + `loadFriends()` action calling `listFriendsFrom(todayKey())`
- [x] 4.2 Add own `postgres_changes` subscription via `useRealtimeSubscription` (`user_availability` filtered `user_id=eq.<uid>`) → refetch own; `onSubscribed` refetches (hidden-tab gap)
- [x] 4.3 Add friend broadcast subscription via `useRealtimeBroadcast` (topic `availability:<uid>`, event `refetch`) → `loadFriends`; `onSubscribed` refetches
- [x] 4.4 Watch `friendshipsStore.friendUserIds` (sorted-join, like `tours-store`) → `loadFriends` on change; clear friend state on sign-out
- [x] 4.5 Call `loadFriends()` alongside `load()` on Planned view mount

## 5. UI (`planned-calendar.vue` + per-day list)

- [x] 5.1 Build `userId → Contact` resolver by inverting `phoneToUserIdMap` (`use-contact-friendship-map` over the contacts store)
- [x] 5.2 `friendsByDay` computed: `dayKey → resolved-friend[]` deduped/keyed by `userId`, sorted by display name, future-only; unresolved userIds fall back to registered profile name via `friendshipsStore.getNamesByUserIds` (call it for any userId not in the contact map), rendered name-only
- [x] 5.2a Trigger `getNamesByUserIds` for the friend userIds present in availability rows (so the profile-name fallback has data), mirroring how friend-tour partner names are fetched
- [x] 5.3 Render up to 2 friend chips per day in their own section (separate from tour pills, additive to the green overlay), independent 2-chip cap; chips are neutral — contact name only, no avatar, no tour-type color
- [x] 5.4 Render "and more" chip when >2; tapping opens a per-day list overlay (bottom sheet on mobile) of all available friends
- [x] 5.5 In `planned-calendar`: own the `ContactActionMenu` (pass tapped chip's `getBoundingClientRect` as `anchorRect`), open it from a friend chip tap and from each "and more" list row; guard unresolved contacts (name-only chip, no menu); re-emit `editContact` upward — mirror `tour-info-sheet`
- [x] 5.6 In `calendar-page`: catch `editContact`, add `editContactId` state + `handleEditContact`/`handleContactsClose`, host `ContactsListSheet` overlay (`:initial-contact-id`) over the calendar — mirror `map-page` (dialog on desktop / bottom sheet on mobile), returning to calendar on close
- [x] 5.7 Add i18n keys to `en.json` + `de-CH.json` (chip "and more" with count, available-friends list title, empty state)

## 6. Tests (edge cases + failures only)

- [x] 6.1 Store: friend broadcast `refetch` triggers `loadFriends`; friend-set change refetches; sign-out clears friend state
- [x] 6.2 Component: `friendsByDay` sorts alphabetically and collapses >2 into "and more"; day with an unresolved friend renders name-only (no crash)
- [x] 6.3 Component: friend chip on a viewer-unavailable day still renders; past friend availability is not shown
- [x] 6.4 Run `npm run test` — all pass

## 8. Post-review fixes

- [x] 8.1 Bug: green overlay leaked onto friend-available days — `listOwnFrom` trusted RLS for scoping, which #244's friend-SELECT policy broadened; filter to own `user_id` explicitly
- [x] 8.2 Open the Planned calendar scrolled to today (mirror the Today button) via `onMounted` → `nextTick(scrollTodayIntoView)`
- [x] 8.3 Crowded-cell overflow redesign (spec updated): per kind, 1 item → show it, ≥2 → a single "N tours"/"N friends" count chip; extracted `day-preview.vue`; clip the cell so nothing spills
- [x] 8.4 Whole non-empty day cell/row opens a per-day detail list (view mode); edit mode still toggles availability
- [x] 8.5 Detail list = tours first, then available friends; `AdaptiveOverlay` (bottom sheet mobile / dialog desktop) over the calendar; tour row → open on map, friend row → contact-action menu; close returns to calendar
- [x] 8.6 Replace friend-only "and more" sheet + i18n (`toursHeading`/`friendsHeading`); update component tests for cap-1 + detail-list behavior

## 7. Finalize

- [x] 7.1 `npx eslint . --fix` — zero warnings; review diff size (editor format-on-save fights antfu)
- [x] 7.2 `npm run type-check`
- [ ] 7.3 Prompt user to commit (do NOT commit) with message: `feat(calendar): sync and show friends' availability (#244)`
- [ ] 7.4 Prompt user to push branch and open a PR to `main`
- [ ] 7.5 Prompt user (do NOT run unprompted) to `supabase db push` the new migration to prod after PR review
