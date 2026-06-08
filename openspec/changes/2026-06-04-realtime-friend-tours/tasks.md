## 1. Git Setup

- [ ] 1.1 `git fetch origin && git checkout main && git pull && git checkout -b feat/198-realtime-friend-tours`
- [ ] 1.2 Verify `supabase status` shows the local stack running (`supabase start` if not).

## 2. Spike: confirm Broadcast-from-Database is available locally

- [ ] 2.1 In `psql` against the local DB, confirm `realtime.send(jsonb, text, text, boolean)` exists and that an RLS policy on `realtime.messages` gates a private channel. (CLI 2.104 / supabase-js ^2.49 are new enough; verify the container honors it before building on it.)
- [ ] 2.2 If unavailable, STOP and revisit the mechanism (fallback: physical `friend_tour_events` table + `postgres_changes` — see design "Why broadcast").

## 3. Migration: friend-tour broadcast trigger

- [ ] 3.1 `supabase migration new friend_tours_broadcast_trigger`.
- [ ] 3.2 **YOUR TURN** — write the broadcast trigger function (audience derivation + `realtime.send` fan-out). See gap task below.
- [ ] 3.3 Attach as `AFTER INSERT OR UPDATE OR DELETE` on `public.tours`.
- [ ] 3.4 `supabase db reset` locally; confirm clean apply.

## 4. Migration: realtime.messages topic authorization

- [ ] 4.1 `supabase migration new friend_tours_realtime_messages_policy`.
- [ ] 4.2 `SELECT` policy on `realtime.messages` for `authenticated`, scoped to the broadcast extension and `friend-tours:` topic prefix, permitting a row only when `auth.uid()::text = split_part(realtime.messages.topic, ':', 2)`.
- [ ] 4.3 `supabase db reset`; verify the policy exists and is enabled.

## 5. Client broadcast primitive

- [ ] 5.1 Add `src/core/realtime/use-realtime-broadcast.ts`: module-level registry keyed by topic (one channel per topic, refcounted), page-visibility pause/resume, reuse of the singleton `TOKEN_REFRESHED` `setAuth` handler.
- [ ] 5.2 Subscribe a **private** channel (`supabase.channel(topic, { config: { private: true } })`), `.on('broadcast', { event: 'refetch' }, …)`, debounced `onMessage` (150 ms), `onSubscribed` after `SUBSCRIBED`.
- [ ] 5.3 Export `__resetRealtimeBroadcastRegistry()` test helper (mirror the postgres_changes primitive).

## 6. Tours store wiring

- [ ] 6.1 In `tours-store`, wire `use-realtime-broadcast` on topic `friend-tours:${uid}` (enabled when authenticated). `onMessage`/`onSubscribed` → debounced `loadFriendTours()` (and nothing else — downstream consumers react via existing watches).
- [ ] 6.2 Add `watch(() => [...friendshipsStore.friendUserIds].sort().join(','), (n, o) => { if (n !== o) loadFriendTours() })` so a newly accepted/removed friendship refetches friend tours immediately.
- [ ] 6.3 Confirm sign-out teardown removes the friend-tours channel and clears `friendTours`.

## 7. Remove redundant signal

- [ ] 7.1 In `tour-links-store.ts`, remove the `onChange` `toursStore.loadFriendTours()` piggyback (line ~333) and its now-false comment ("`friend_tours_view` has no realtime binding (#198)…"). Keep the `fetchAll()` call. Leave `collision-notice.vue` watchers untouched.

## 8. Tests

- [ ] 8.1 Broadcast primitive: topic key derivation, refcount dedupe, visibility pause → channel removed, `onMessage` debounce, `onSubscribed` after SUBSCRIBED.
- [ ] 8.2 `tours-store`: friend-tours topic is `friend-tours:${uid}`; a message triggers `loadFriendTours` after debounce; a `friendUserIds` change triggers `loadFriendTours`; no subscription when unauthenticated.
- [ ] 8.3 Trigger (pgTAP / SQL harness): friends-visible insert → one `realtime.messages` row per accepted friend on the right topic; private insert → none; friends→private UPDATE → OLD audience notified; non-friend never notified.
- [ ] 8.4 `realtime.messages` policy: a session subscribed to another user's `friend-tours:<other>` receives nothing; own topic receives the poke.
- [ ] 8.5 No notification dispatch invoked from the broadcast `onMessage` handler.
- [ ] 8.6 `npm run test` — all pass.

## 9. Manual verification

- [ ] 9.1 Two users A and B, accepted friends, separate sessions (local Supabase + dev server).
- [ ] 9.2 A creates a `visibility='friends'` tour → B's Friends tab + friend map markers update within one debounce window, no reload.
- [ ] 9.3 A and B add the same tour (same goal + activity) → the "request to link" disclaimer appears in B's `collision-notice.vue` in realtime (the #198 motivating bug).
- [ ] 9.4 A edits the shared tour (moves goal) → B reflects it.
- [ ] 9.5 A flips the tour friends→private → it disappears from B's Friends tab/map (OLD-audience broadcast).
- [ ] 9.6 A deletes a friends-visible tour → B drops it.
- [ ] 9.7 New-friendship-accept: C and A become friends while both signed in → A's existing friends-visible tours appear for C immediately (friend-set watch), without reload.
- [ ] 9.8 Negative: a NON-friend D never receives any friend-tours broadcast for A (DevTools → WS frames).
- [ ] 9.9 Hidden-tab gap: background B's tab while A edits, then foreground B → `onSubscribed` refetch reconciles.

## 10. Finalize

- [ ] 10.1 `npx eslint . --fix` — zero warnings.
- [ ] 10.2 `npm run type-check` — passes.
- [ ] 10.3 `npm run test` — all pass.
- [ ] 10.4 Prompt user to commit. Suggested message:
      ```
      feat(tours): realtime sync for friends' tours via server-side broadcast

      Friend tours could not live-sync: friend visibility (friendship +
      visibility='friends' + per-viewer partner gating) is not expressible as
      a postgres_changes filter, which would also leak Layer-2 detail and
      cannot deliver friends->private visibility-loss events. Add an AFTER
      INSERT/UPDATE/DELETE trigger on public.tours that computes the owner's
      accepted-friend audience and realtime.send's a signal-only poke to each
      friend's private topic friend-tours:<uid>; clients refetch friendTours
      through the RLS-gated friend_tours_view, so no unauthorized row or detail
      crosses the wire. Adds a realtime.messages RLS policy scoping each topic
      to its owner and a use-realtime-broadcast client primitive. A friendUserIds
      watch refetches on new-friendship-accept. Removes the now-redundant
      tour-links loadFriendTours piggyback.

      Closes #198
      ```
- [ ] 10.5 Prompt user to `git push -u origin feat/198-realtime-friend-tours` and open a PR against `main`.
- [ ] 10.6 Prompt user to `supabase db push` against prod *only after* PR approval (confirm prod realtime honors broadcast + the messages policy).
- [ ] 10.7 After merge, prompt user to archive this change with `/opsx:archive`.

---

## Your turn

**File:** `supabase/migrations/<new timestamp>_friend_tours_broadcast_trigger.sql`
**Lines:** the trigger function body (task 3.2)
**Gap:** the function that derives the authorized audience and fans out the broadcast

**What it needs to do:**
- `AFTER INSERT OR UPDATE OR DELETE` on `public.tours`.
- Decide whether to broadcast: fire when `NEW.visibility='friends'` (INSERT/UPDATE) OR `OLD.visibility='friends'` (DELETE / friends→private). Do nothing for private→private.
- Enumerate the owner's **accepted friends** from `public.friendships` (both directions: owner is `request_user_id` or `response_user_id`, take the other side).
- For each friend id: `realtime.send(payload jsonb, 'refetch', 'friend-tours:'||friend_id, true)` with a **signal-only** payload (e.g. `{ op, tour_id, owner_id }` — NO tour detail fields).
- Use the OLD row for the owner + audience on DELETE / friends→private; NEW otherwise. Do NOT compute partner gating (audience = accepted friends; the view gates detail on refetch).
- `security definer`, `set search_path = ''`, fully-qualified names; mirror existing trigger functions in `supabase/migrations/`. Confirm the `realtime.send(...)` signature for the installed version.

**How to verify:**
- Automated: a SQL/pgTAP test — insert a `visibility='friends'` tour as owner A (B an accepted friend) → assert one `realtime.messages` row on `friend-tours:<B>`; insert a `private` tour → assert zero; UPDATE friends→private → assert B notified via OLD audience; assert a non-friend C is never notified.
- Manual: tasks §9.

**Done when:** a friends-visible tour write notifies exactly the owner's accepted friends (and only them) on their own topics, private writes notify nobody, and visibility flips / deletes notify the correct (OLD-row) audience.
