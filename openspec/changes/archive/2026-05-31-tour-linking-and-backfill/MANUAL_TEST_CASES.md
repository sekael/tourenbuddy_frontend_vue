# Manual Test Cases — tour-linking-and-backfill

Focus: UI/UX of tour linking, collision-detected notifications, and edge cases.

## Prerequisites

1. **Local Supabase stack running**: `supabase start` — confirm `http://127.0.0.1:54321` reachable.
2. **Frontend** running against local DB: `npm run dev` with `.env.local` pointing `VITE_SUPABASE_URL=http://127.0.0.1:54321`.
3. **Worker** running locally for notification dispatch testing:
   ```sh
   cd services/email-hook && npm run dev
   ```
   Set frontend `.env.local`:
   - `VITE_NOTIFICATIONS_ENABLED=true`
   - `VITE_NOTIFY_HOOK_URL=http://localhost:8787` (or wherever wrangler dev landed)
4. **Three existing accounts** — used throughout, no extra users to create:
   - **Patrick**: `patrick@tourenbuddy.ch`
   - **Jakob**:   `jakob@tourenbuddy.ch`
   - **Selim**:   `selim@tourenbuddy.ch`

   You need access to each inbox to complete OTP login. (Or use whatever local-dev login shortcut is wired up.)

### Resolve UUIDs (one-time, before SQL operations)

Open Supabase Studio SQL editor at `http://127.0.0.1:54323`:

```sql
select id, email from auth.users
  where email in ('patrick@tourenbuddy.ch', 'jakob@tourenbuddy.ch', 'selim@tourenbuddy.ch');
```

Copy the three UUIDs. Anywhere this doc says `11111111-1111-1111-1111-111111111111` / `22222222-2222-2222-2222-222222222222` / `44444444-4444-4444-4444-444444444444`, substitute the real value.

> If any account is missing, sign in once via the frontend so Supabase auto-creates the auth.users row and the `user_profile` row via the existing onboarding flow.

### Ensure mutual friendships exist

```sql
-- Idempotent — the unordered_pair unique index swallows duplicates.
insert into public.friendships (request_user_id, response_user_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222',   '44444444-4444-4444-4444-444444444444'),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444')
on conflict do nothing;
```

Verify:

```sql
select request_user_id, response_user_id from public.friendships
  where request_user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444')
     or response_user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444');
```

You should see three rows.

### Test goals (copy-paste coordinates)

| Label | LNG | LAT | Notes |
| --- | --- | --- | --- |
| **G_TÖDI** | 8.9145 | 46.8170 | Primary collision point |
| **G_NEAR** | 8.9148 | 46.8172 | ~30 m from G_TÖDI — inside 100 m |
| **G_BOUNDARY** | 8.9145 | 46.8179 | ~100 m from G_TÖDI — on the edge |
| **G_FAR** | 8.9145 | 46.8200 | ~330 m from G_TÖDI — outside 100 m |
| **G_REMOTE** | 9.5000 | 47.0000 | Far away, used for "move to break group" |

### State-reset helper

Between test cases, wipe link state + the test tours without touching real data:

```sql
delete from public.tour_link_request;
delete from public.tour_link_member;
delete from public.tour_link_group;
delete from public.tours where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');
```

> **Heads up:** this wipes ALL tours owned by the three test accounts. If any of these accounts also hold real tours you want to preserve, narrow the delete with a `name like 'TEST-%'` predicate and prefix all test tour names accordingly.

To verify any current state mid-test:

```sql
select 'groups' as kind, count(*)::text as val from public.tour_link_group
union all select 'members', count(*)::text from public.tour_link_member
union all select 'pending', count(*)::text from public.tour_link_request where status='pending'
union all select 'requests-all', count(*)::text from public.tour_link_request;
```

---

## Group A — Collision-detected notification (post-save scan)

### A1. Friend plans the same tour → push + email notification

**Setup:**
1. Log in as **Jakob**. Create a tour at **G_TÖDI** with `tour_type = skitour`, visibility `friends`, name "Tödi (Jakob)".
2. Log out, switch profile / different browser, log in as **Patrick**.
3. In Patrick's preferences, ensure push + email enabled and `tour_interest` toggle ON.

**Action:**
4. As Patrick, click the map at **G_NEAR**, pick `skitour` as type, name "Tödi (Patrick)", visibility `friends`, save.

**Expected:**
- Tour saves immediately — **no duplicate-prompt dialog appears** (this was the legacy flow; deleted in this change).
- Within ~5 s, Jakob receives a push notification with title "Interest in your tour" (DE: "Interesse an deiner Tour") and body referencing Patrick.
- Jakob's inbox (`jakob@tourenbuddy.ch`) receives the `tour_interest_*` template with `action = collision`.
- SQL check: `select count(*) from public.tours where name like 'Tödi%';` returns `2`.

### A2. Recipient muted tour_interest → no dispatch

**Setup:** Reset state. As Jakob: profile → notifications → toggle off `tour_interest` ("Same-tour collaboration suggestions"). Recreate Jakob's Tödi tour as in A1.

**Action:** As Patrick, plant a colliding tour at **G_NEAR**.

**Expected:**
- Tour saves, no error.
- Jakob receives **no** push and **no** email.
- Worker log shows scan ran (collision found), dispatch suppressed by mute.

### A3. Tour outside 100 m radius → no notification

**Setup:** Reset state. Jakob creates Tödi tour at **G_TÖDI**. Patrick re-enables `tour_interest` in preferences.

**Action:** As Patrick, plant tour at **G_FAR** with `skitour` type.

**Expected:**
- Tour saves.
- Jakob receives **no notification**.
- SQL verify: `select fn_collision_predicate('<patrick_tour_id>', '<jakob_tour_id>');` returns `false`.

### A4. Different tour_type → no collision

**Setup:** Reset state. Jakob creates tour at **G_TÖDI** with type `skitour`.

**Action:** As Patrick, plant tour at **G_NEAR** with type `hiking`.

**Expected:**
- Tour saves.
- Jakob receives **no notification**.
- Predicate returns `false`.

### A5. Private tour does not collide

**Setup:** Reset state. Jakob creates tour at **G_TÖDI** with visibility `private` (use the info-sheet visibility toggle on a fresh tour).

**Action:** As Patrick (visibility `friends`), plant at **G_NEAR**.

**Expected:**
- Tour saves.
- Jakob receives **no notification**.
- Patrick's info sheet shows **no collision notice** (Jakob's tour isn't in his `friend_tours_view`).

### A6. Exactly 100 m boundary

**Setup:** Reset state. Jakob creates Tödi tour at **G_TÖDI**.

**Action:** Patrick creates tour at **G_BOUNDARY** with `skitour`.

**Expected:**
- The check is `ST_DWithin ≤ 100`, so the boundary point should match (PostGIS treats `<= distance` inclusively).
- Jakob receives a notification.
- If you want to confirm just-outside, nudge Patrick's tour 1 m further north and verify the predicate flips.

### A7. tour_type NULL → never collides

**Setup:** Reset state.

**Action:** Both Patrick and Jakob create tours at **G_TÖDI** without setting a tour type.

**Expected:**
- Neither receives a notification.
- SQL check: `select fn_collision_predicate(a, b) from (...)` returns `false` because `a.tour_type IS NOT NULL` short-circuits.

---

## Group B — Collision notice + link request lifecycle (UI)

### B1. Collision notice appears for owner

**Setup:** Reset state. Jakob creates Tödi tour at **G_TÖDI**.

**Action:** Patrick creates colliding tour at **G_NEAR**. Open Patrick's tour info sheet (click marker on map or open from tour list).

**Expected:**
- A "Same tour planned" notice card renders with:
  - Title "Same tour planned" / "Gleiche Tour geplant"
  - Body lists Jakob's name
  - A "Request to link with Jakob …" button
- The notice does NOT appear on Jakob's tour info sheet (it only renders for the owner's own tour view → `v-if="isOwner"`).

### B2. Send link request → outgoing banner appears


**Action:** From Patrick's info sheet, click "Request to link with Jakob …". Within 1–2 s realtime should push the new request.

**Expected:**
- Patrick's info sheet swaps the collision-notice card for a **"Link request sent to Jakob…"** banner with a **Withdraw** button.
- Jakob receives a push: "Interest in your tour" with body referencing Patrick's request.
- SQL check:
  ```sql
  select status, initiator_tour_id, target_tour_id from public.tour_link_request order by created_at desc limit 1;
  ```
  Returns `status='pending'`.

### B3. Target sees incoming banner

**Action:** Switch to Jakob's tab/browser. Open his Tödi tour info sheet.

**Expected:**
- Above the tour details, a banner reads "Patrick … wants to link "Tödi (Patrick)" with this tour." with **Accept** and **Decline** buttons.
- The banner has a left blue border (incoming styling).

### B4. Accept → both tours show "Linked with"

**Action:** Jakob clicks **Accept**.

**Expected:**
- Banner disappears.
- Jakob's info sheet shows a **"Linked with"** section header with a single pill "Patrick …".
- Within ~2 s Patrick's view also shows "Linked with" → "Jakob …".
- Patrick receives a push notification: action `link_accepted`.
- SQL check:
  ```sql
  select g.id, m.tour_id from public.tour_link_group g
    join public.tour_link_member m on m.group_id = g.id;
  ```
  Returns 1 group, 2 member rows.

### B5. Click a pill → navigates to sibling tour

**Action:** From Jakob's info sheet, click the "Patrick …" pill.

**Expected:**
- The map selects Patrick's tour and opens his info sheet. From Jakob's perspective Patrick's tour is a friend tour (read-only).
- No console errors.

### B6. Decline path

**Setup:** Reset state. Recreate Patrick + Jakob tours, Patrick sends request as in B2.

**Action:** Jakob clicks **Decline** on the incoming banner.

**Expected:**
- Banner disappears for Jakob.
- Patrick's view: banner disappears.
- Patrick receives push action `link_declined`.
- SQL check: `select status from public.tour_link_request order by created_at desc limit 1;` returns `'declined'`.
- No `tour_link_member` rows created.

### B7. Withdraw path → no notification to target

**Setup:** Reset state. Patrick sends request.

**Action:** Before Jakob acts, Patrick clicks **Withdraw** on his outgoing banner.

**Expected:**
- Banner disappears for both.
- Jakob receives **NO push** (withdrawals are silent per design).
- SQL check: `select status from public.tour_link_request ...;` returns `'withdrawn'`.

### B8. Re-create after decline

**Setup:** Continue from B6 (decline state).

**Action:** Patrick sends a new request from the same info sheet.

**Expected:**
- New `pending` row is accepted by RPC (the unique partial index only constrains `status='pending'` rows).
- Jakob's incoming banner reappears.
- `select count(*) from public.tour_link_request;` shows 2 rows: 1 declined + 1 pending.

### B9. Duplicate pending blocked

**Setup:** From B2 state (pending request alive).

**Action:** In a second Patrick browser tab, attempt to send the same link request again by manipulating the UI or directly via RPC. Run in the SQL editor:

```sql
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select public.create_link_request('<patrick_tour_id>', '<jakob_tour_id>');
```

**Expected:** Postgres raises `duplicate key value violates unique constraint "tour_link_request_one_pending"` — the partial unique index works as intended.

---

## Group C — N-way group growth (3 members)

### C1. Third tour joins existing pair

**Setup:** Reset state. Complete B4 — Patrick and Jakob are linked.

**Action:**
1. Log in as Selim. Create tour at **G_NEAR** with `skitour`, friends.
2. Open Selim's info sheet → collision notice should list BOTH Patrick and Jakob with separate "Request to link" buttons.
3. Click "Request to link with Patrick …".
4. Switch to Patrick. Banner shows incoming from Selim. Accept.

**Expected per design D11 (one-existing-member-accept):**
- Only **Patrick** accepts — Jakob is NOT asked again.
- Selim joins Patrick's existing group.
- All three info sheets now show "Linked with" with **2 pills** (the two siblings, not the self).
- SQL verify:
  ```sql
  select count(*) from public.tour_link_group;            -- 1
  select count(*) from public.tour_link_member;           -- 3
  ```

### C2. "+N more" overflow

**Setup:** Continue from C1 (3 in group).

**Action:**
- Open one of the linked tours and verify the section shows two pills inline (no "+N more").
- Real "+N more" overflow requires 4+ siblings — only achievable here by adding a fourth friend account, so this case is informational unless extra accounts are available.

**Expected (when ≥4 siblings):**
- First 2 pills inline, a **"+N more"** pill at the end.
- Click "+N more" → opens an overlay (bottom sheet on mobile, dialog on desktop) listing all remaining friends with name + tour name per row.
- Click a row → navigates to that tour, closes overlay.

### C3. Merge of two multi-tour groups forbidden

This rule is hard to exercise from the UI with only 3 accounts (needs two independent multi-tour groups). Test directly via SQL on a contrived state:

```sql
-- Set up: Patrick+Jakob already linked from B4. Manually create a second 2-member
-- group consisting of Selim + a duplicate tour owned by another (e.g. clone Selim's
-- tour to a different user). For a 3-account environment, a meaningful merge-test
-- requires a fourth tour by a fourth account. Skip if unavailable.
```

**Expected (when fully set up):** `create_link_request` raises `tour_link.merge_forbidden`. Frontend shows the error inline.

---

## Group D — Edit-warning dialog (eviction soft-gate)

### D1. Change tour type → warning appears

**Setup:** Reset state. Patrick + Jakob linked.

**Action:** As Patrick, open his info sheet, click Edit, change tour_type from `skitour` to `hiking`, click Save.

**Expected:**
- **Before the update fires**, a warning dialog appears: "This will unlink the tour — This change will unlink this tour from 1 friend tour(s) it is currently grouped with."
- Two buttons: **Cancel** and **Save & unlink**.

### D2. Cancel keeps the link

**Action:** Click **Cancel** on the D1 dialog.

**Expected:**
- Dialog closes.
- Tour remains in edit mode (form still showing).
- SQL verify: `select tour_type from public.tours where id='<patrick_tour_id>';` still `skitour`.
- `select count(*) from public.tour_link_member;` still 2.

### D3. Confirm unlink

**Action:** Re-trigger D1, click **Save & unlink**.

**Expected:**
- Update commits.
- Trigger `fn_evict_member_on_tour_change` fires → Patrick's tour evicted.
- Group dissolves (count drops below 2 → `fn_dissolve_when_below_two` deletes the group).
- Patrick's info sheet no longer shows "Linked with".
- Jakob's info sheet no longer shows "Linked with" (within realtime delay; lazy refetch on next sheet open).
- SQL verify: `select count(*) from public.tour_link_group;` returns 0.
- Jakob receives a `group_dissolved` notification.

### D4. Move goal far away → eviction

**Setup:** Reset state. Patrick + Jakob linked.

**Action:** Patrick clicks Edit, picks a new goal at **G_REMOTE**, Save → confirm warning.

**Expected:**
- Update fires. Trigger detects goal >100 m from sibling → evicts Patrick.
- Group dissolves (below 2 members).
- Same outcome as D3.

### D5. Move goal within radius → NO eviction

**Setup:** Reset state. Patrick + Jakob linked. Note: D1 dialog fires for *any* goal move (client-side check is coarse).

**Action:** Patrick edits, picks **G_NEAR** (still within 100 m of Jakob), confirms warning ("Save & unlink").

**Expected:**
- Warning dialog showed (frontend doesn't compute exact sibling distances — it's a soft warning).
- DB trigger evaluates the actual distance: **no eviction** because new goal is still within 100 m of Jakob's.
- "Linked with" stays on both sheets.
- SQL verify: `select count(*) from public.tour_link_member;` still 2.

> The frontend warning is intentionally conservative — better to over-prompt than miss an eviction.

### D6. Visibility flip from friends → private evicts

**Setup:** Reset state. Patrick + Jakob linked.

**Action:** Patrick edits, toggles visibility from `friends` to `private`, Save → confirm warning.

**Expected:**
- Trigger fires → Patrick's tour evicted (visibility change away from `friends`).
- Group dissolves.
- Jakob's info sheet loses "Linked with" pill; tour-list view no longer shows Patrick's tour at all (private → hidden from friends).

---

## Group E — Tour delete

### E1. Delete linked tour shows extended warning

**Setup:** Patrick + Jakob linked.

**Action:** As Patrick, open info sheet, click Delete.

**Expected:**
- Confirmation card shows BOTH lines:
  1. "Delete this tour?"
  2. "This tour is linked with 1 friend tour(s). Deleting will unlink them."
- Then Cancel / Delete buttons.

### E2. Confirm delete cascades

**Action:** Click Delete.

**Expected:**
- Tour gone.
- `tour_link_member` row for that tour gone (cascade).
- Group dissolves (below 2).
- Jakob's view updates (lazy refetch on next sheet open).

### E3. Delete an unlinked tour — no link warning

**Setup:** Reset state. Patrick has a solo tour with no group.

**Action:** Delete.

**Expected:**
- Only "Delete this tour?" — no "linked with…" line.

---

## Group F — Friendship break

### F1. Two-member group dissolves on friendship delete

**Setup:** Patrick + Jakob linked.

**Action:** As Patrick, in the Friends list, remove Jakob as friend (or run SQL):

```sql
delete from public.friendships
  where (request_user_id = '11111111-1111-1111-1111-111111111111' and response_user_id = '22222222-2222-2222-2222-222222222222')
     or (request_user_id = '22222222-2222-2222-2222-222222222222'   and response_user_id = '11111111-1111-1111-1111-111111111111');
```

**Expected:**
- `fn_evict_on_friendship_delete` fires.
- Both tours evicted, group dissolves.
- Both sheets lose the "Linked with" section.
- Both users receive `group_dissolved` notification (if not muted).
- Any pending link request between Patrick and Jakob is auto-set to `withdrawn`.

> **Important:** restore the friendship afterward to keep the rest of the suite working:
> ```sql
> insert into public.friendships (request_user_id, response_user_id)
>   values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222') on conflict do nothing;
> ```

### F2. Three-member group dies if any pair breaks

**Setup:** Patrick + Jakob + Selim all in one group (C1 state).

**Action:** Patrick removes Jakob (UI or SQL above).

**Expected (per design D11 — 3-way dies):**
- Both Patrick's AND Jakob's tour evicted.
- Only Selim remains (count = 1 → below 2).
- Group dissolves.
- All three receive a `group_dissolved` notification.
- SQL verify: all of `tour_link_group`, `tour_link_member` rows are 0.

> Restore the friendship again afterward.

---

## Group G — Friendship-accept backfill digest

### G1. New friendship surfaces pre-existing overlaps

**Setup:** Reset state. **Remove** Patrick↔Jakob friendship first:

```sql
delete from public.friendships
  where (request_user_id = '11111111-1111-1111-1111-111111111111' and response_user_id = '22222222-2222-2222-2222-222222222222')
     or (request_user_id = '22222222-2222-2222-2222-222222222222'   and response_user_id = '11111111-1111-1111-1111-111111111111');
```

Both create overlapping `friends`-visible `skitour` tours at **G_TÖDI** while NOT friends.

**Action:** From Patrick, send a friend request to Jakob. Jakob accepts.

**Expected:**
- Standard friend-request-accepted notification fires (sub-routine A).
- ALSO: backfill digest fires (sub-routine B) — both Patrick and Jakob receive a `tour_interest` push action `backfill_digest`:
  - Title "Shared tours with new friend" / "Gemeinsame Touren mit neuem Freund"
  - Body: "1 of your tours overlap with Jakob's tours."
  - The push deep-links to `/friends/<request_id>/backfill-collisions`.

### G2. Backfill page renders the overlap list

**Action:** Click the digest push (or manually navigate to `/friends/<friend_request_id>/backfill-collisions`).

**Expected:**
- Page header "Tour overlaps with this friend".
- One row: "Tödi (Patrick) ⇄ Tödi (Jakob)" with a "Request to link" button.
- Click the button → request fires (action `link_created`), Jakob gets a push, the row disappears from Patrick's backfill list.

### G3. Empty state

**Setup:** Continue from G2 after handling the only pair, or test a friendship where there are no overlaps.

**Action:** Refresh the backfill page.

**Expected:** "No tour overlaps to review." empty-state copy renders.

### G4. Recipient muted → no digest

**Setup:** Jakob mutes `tour_interest`.

**Action:** Repeat G1.

**Expected:**
- Patrick still receives his digest.
- Jakob receives NO digest (neither push nor email).
- The other sub-routine (friend-request-responded notification) still fires for Patrick's normal "Jakob accepted" ping.

### G5. Sub-routine failure isolation

**Action (manual via Worker logs):**
- Temporarily break the digest path (e.g., point `SUPABASE_URL` to a bad host in the local worker dev) and trigger an accept.
- Confirm the responded notification still goes out (sub-routine A); only the digest fails.
- Restore config.

**Expected:** Worker logs show `[notify/responded] backfill digest failed:` but the endpoint returns 200 and the responded push lands.

---

## Group H — Map link badge

### H1. Linked tour shows blue badge

**Setup:** Patrick + Jakob linked. Both their tours are on the map (Patrick as owner, Jakob as friend-partner marker).

**Action:** Look at the map.

**Expected:**
- Patrick's marker has a small blue circle in the upper-right corner (the link indicator).
- The badge stays on through pan + zoom.
- When zoomed out into a cluster, the badge disappears (it filters on individual visible markers, not clusters).

### H2. Badge disappears on unlink

**Action:** Trigger D3 / D4 / F1 to dissolve the group.

**Expected:** Badge disappears within ~2 s (realtime refresh on `tour_link_request` triggers a member refetch).

---

## Group I — Notification preferences UI

### I1. Tour-interest toggle label + description

**Action:** Open profile → notifications.

**Expected:**
- The `tour_interest` row label reads **"Same-tour collaboration suggestions"** (DE: "Hinweise auf gleiche Touren").
- Directly beneath, a smaller description: "Pings when a friend plans the same tour, link requests, and overlap digests after a new friendship."
- The toggle is independently controllable.
- `friend_requests` and `tour_updates` rows do NOT show a description row (only `tour_interest` does).

### I2. Mute then unmute toggles in real time

**Action:** Toggle `tour_interest` off, then have another user trigger a collision; toggle back on and trigger again.

**Expected:** No push when muted; push resumes when unmuted.

---

## Group J — Tour-list view / map precedence regression

### J1. Owned tour shadows friend tour at same goal

**Setup:** Patrick + Jakob both have tours at exactly the same goal (G_TÖDI) but NOT linked.

**Expected:**
- Map: only Patrick's marker shows (owned tours take precedence over friend tours within 100 m).
- Tour list: both tours still listed.

### J2. Selecting friend tour in list unshadows it on the map

**Action:** Open the tours sheet / list, click Jakob's tour.

**Expected:**
- Patrick's marker disappears temporarily; Jakob's marker shows; GPX track (if any) for Jakob renders.
- Close the friend info sheet → reverts.

### J3. Removing the duplicate dialog didn't break this

**Action:** As Patrick, try planting a new tour at **G_NEAR** (collides with Jakob's).

**Expected:**
- Tour saves immediately.
- No "Duplicate tour" modal.
- Worker scan fires the collision notification.

---

## Group K — RPC negative paths (SQL-only)

### K1. Predicate violation rejected at create_link_request

```sql
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
-- Two tours far apart:
select public.create_link_request('<patrick_far_tour>', '<jakob_far_tour>');
```

**Expected:** `tour_link.predicate_failed`.

### K2. Non-owner cannot initiate

```sql
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select public.create_link_request('<patrick_tour_id>', '<jakob_tour_id>');
```

**Expected:** `tour_link.not_initiator_owner` (errcode 42501).

### K3. Non-owner cannot accept

```sql
-- A pending request from Patrick to Jakob exists.
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select public.accept_link_request('<request_id>');
```

**Expected:** `tour_link.not_target_owner`.

### K4. Non-initiator cannot withdraw

```sql
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select public.withdraw_link_request('<patrick_initiated_request_id>');
```

**Expected:** `tour_link.not_initiator_owner`.

---

## Group L — Realtime + multi-tab


### L1. Two browsers see request status flip in real time

**Setup:** Patrick + Jakob both open, info sheets showing the same Tödi tours.

**Action:** Patrick clicks "Request to link". Watch Jakob's tab.

**Expected:** Within ~2 s (Supabase Realtime publication on `tour_link_request`), Jakob's info sheet renders the incoming banner without manual refresh.

### L2. Mid-flight withdraw

**Action:** As Patrick click Request. As Jakob, BEFORE clicking Accept, watch the banner. Then quickly switch back to Patrick and click Withdraw.

**Expected:** Jakob's banner disappears within ~2 s on its own (status flipped to `withdrawn`).

---

## Group M — Internationalization sanity

### M1. Switch to DE locale → all new strings translated

**Action:** Set profile locale to `de-CH`. Reopen the app.

**Expected:**
- "Linked with" → "Verknüpft mit"
- Collision notice title "Gleiche Tour geplant"
- Banner "{name} möchte «{tour}» mit deiner Tour verknüpfen."
- Backfill page title "Tour-Überschneidungen mit diesem Freund"
- Toggle label "Hinweise auf gleiche Touren"

No literal `tourLinks.*` key strings should appear in the UI (would indicate missing translation).

---

## Group N — Stress / edge cases

### N1. Stale pending request auto-voids on eviction (existing path — grouped tour)

**Setup:** Patrick + Jakob linked (B4 state). Selim sends a pending request to Patrick (C1-like, but stop before Patrick accepts).

**Action:** As Patrick, edit Patrick's tour and change `tour_type` from `skitour` to `hiking`. Confirm the **linked**-mode warning dialog ("This will unlink the tour").

**Expected:**
- Trigger `fn_evict_member_on_tour_change` evicts Patrick → group dissolves.
- The same trigger calls `fn_void_pending_requests_for_tour(patrick_tour_id)` → Selim's pending request flips to `withdrawn`.
- Selim's outgoing banner disappears via realtime within ~2 s.
- SQL: `select status from public.tour_link_request where initiator_tour_id='<selim_tour_id>' order by created_at desc limit 1;` → `'withdrawn'`.

### N2. Accept after predicate breaks (server safety net)

**Setup:** Patrick sends request. Before Jakob accepts, Jakob's tour goal moves to G_REMOTE — but BYPASS the new client warning (edit via direct SQL or another device that doesn't have the latest client):

```sql
update public.tours set goal = extensions.st_setsrid(extensions.st_makepoint(9.5, 47.0)::extensions.geography, 4326)::extensions.geography
  where id = '<jakob_tour_id>';
```

**Action:** With the new `trg_void_pending_requests_on_tour_change` trigger (migration `20260530120000`), the SQL update should auto-withdraw the request before Jakob can accept. So Jakob's incoming banner should disappear within ~2 s realtime, and any racing attempt to accept the now-non-pending row returns "no pending request" / `tour_link.not_pending`.

**Expected:**
- `select status from public.tour_link_request order by created_at desc limit 1;` → `'withdrawn'`, `resolved_at` set.
- If a race produces an accept call against the now-withdrawn row, `accept_link_request` raises `tour_link.not_pending` (or equivalent). UI surfaces it inline.

### N3. Multiple colliding friends → multiple buttons

**Setup:** All three users have tours at G_TÖDI. Patrick opens his info sheet.

**Expected:** Collision notice lists BOTH Jakob and Selim in the body and renders TWO "Request to link with …" buttons (one per friend).

### N4. Edit-warning fires for OUTGOING pending request even when not grouped (Issue 1 fix)

**Setup:** Reset state. Both Jakob (G_TÖDI) and Patrick (G_NEAR) have overlapping `skitour` friends-visible tours, NOT yet linked. As Patrick, open info sheet → click "Request to link with Jakob …". Confirm a pending request exists (`tour_link_request` row, status `pending`). Patrick's tour is **not** in any `tour_link_member` row.

**Action:** As Patrick, click Edit, pick a new goal at **G_REMOTE**, click Save.

**Expected:**
- Warning dialog appears in **pending** mode:
  - Title: "This will cancel pending link request(s)" / "Diese Änderung verwirft offene Verknüpfungsanfrage(n)"
  - Body: "This change breaks the location match for 1 pending link request(s). The request(s) will be cancelled."
  - CTA: "Save & cancel request" / "Speichern und Anfrage zurückziehen"
- On Cancel → tour stays at G_NEAR, request still `pending`.
- On Confirm:
  - Tour update commits.
  - `trg_void_pending_requests_on_tour_change` fires; the pending request flips to `'withdrawn'` with `resolved_at` set.
  - Jakob's incoming banner disappears via realtime within ~2 s.
  - **No** push or email is sent to Jakob (withdrawal is silent per Task 3.3).
- SQL verify: `select status from public.tour_link_request order by created_at desc limit 1;` → `'withdrawn'`.

### N5. Edit-warning fires for INCOMING pending request with incoming-specific copy (Issue 1 fix)

**Setup:** Reset state. Patrick + Jakob have overlapping tours, NOT linked. Jakob sends a link request to Patrick (so Patrick is the **target** of a pending row).

**Action:** As Patrick, edit Patrick's tour and change `tour_type` from `skitour` to `hiking`. Save.

**Expected:**
- Warning dialog appears in **incoming** mode (Patrick is not grouped, only target of someone else's pending request):
  - Title: "Pending link requests will be withdrawn" / "Offene Verknüpfungsanfragen werden zurückgezogen"
  - Body: "There are 1 outstanding link request(s) for this tour. Applying these changes will automatically withdraw them." / "Für diese Tour gibt es 1 offene Verknüpfungsanfrage(n). Wenn du die Änderungen speicherst, werden sie automatisch zurückgezogen."
  - The copy does **NOT** say "your pending link request(s)" / "die du gesendet hast" — Patrick never sent any request.
- On Confirm: pending row flips to `'withdrawn'`; Jakob's outgoing banner clears within ~2 s; no notification dispatched.

### N5b. Edit-warning copy for OUTGOING requests (regression of N4 copy)

**Setup:** As in N4 — Patrick has a pending OUTGOING request to Jakob.

**Action:** As Patrick, edit Patrick's tour off-collision.

**Expected:**
- Warning dialog title: "This will cancel pending link request(s)" / "Diese Änderung verwirft deine offene(n) Verknüpfungsanfrage(n)"
- Body: "This change breaks the location match for 1 pending link request(s) you sent. The request(s) will be cancelled." / "Diese Änderung passt nicht mehr zu 1 offenen Verknüpfungsanfrage(n), die du gesendet hast. Die Anfrage(n) werden zurückgezogen."
- Distinct from N5: explicit ownership ("you sent" / "die du gesendet hast").

### N5c. Mixed incoming + outgoing falls back to incoming copy

**Setup:** Patrick has BOTH an outgoing pending request to Jakob AND an incoming pending request from Selim — all on Patrick's same tour.

**Action:** As Patrick, edit Patrick's tour goal to G_REMOTE (breaks predicate for both pairs).

**Expected:**
- Warning dialog shows the **incoming**-mode title/body with the combined count: "There are 2 outstanding link request(s) for this tour. …" (mixed mode reuses incoming copy because it covers both directions without overclaiming).
- On Confirm: both pending rows flip to `'withdrawn'`.

### N6. Visibility flip from friends → private with pending request (Issue 1 fix)

**Setup:** Patrick has a pending outgoing request to Jakob. Patrick's tour is `visibility = 'friends'`, not grouped.

**Action:** As Patrick, open info sheet, toggle visibility from `friends` to `private`.

**Expected:**
- Warning dialog appears in **pending** mode (since Patrick is not grouped but has an outgoing pending request).
- On Confirm: tour visibility flips to `private`; trigger withdraws the pending request; banners on both sides disappear; no notification.

### N7. Edit that does NOT break the predicate → no warning, request stays pending

**Setup:** Patrick has a pending outgoing request to Jakob (predicate currently holds).

**Action:** As Patrick, edit and pick a new goal at **G_NEAR** (still within 200 m of Jakob's G_TÖDI). Save.

**Expected:**
- **No warning dialog** — client-side predicate mirror determined the request would still be valid.
- Tour saves directly.
- Request remains `pending`.
- SQL: trigger ran but re-evaluated `fn_collision_predicate` as still `true`, no status change.

---

## Group O — In-app backfill entry from Friends tab (Issue 2)

### O1. Friends tab shows "Review tour overlaps" button

**Setup:** Reset state. Patrick + Jakob are friends (or any accepted friendship). Both have at least one `friends`-visible `skitour` tour, with goals colliding (e.g. G_TÖDI vs G_NEAR), NOT yet linked and no pending request.

**Action:** As Patrick, open the My Tours list. Switch to **Friends** tab.

**Expected:**
- A button "Review tour overlaps" / "Tour-Überschneidungen prüfen" renders below the tab bar, above the search input, with a primary-colored outline.
- The same button is **not** rendered on the **Owned** tab.
- On a fresh account with **zero accepted friendships**, the button is hidden on the Friends tab.

### O2. Tap opens embedded backfill view in same surface

**Action:** Tap the button.

**Expected:**
- The sheet body swaps to the embedded backfill view inside the **same** surface (BottomSheet on mobile, SideDrawer on desktop). No route navigation occurs; URL stays at `/`.
- Header reads "Tour overlaps with this friend" (the page header is shared with the digest-deeplink route).
- The list shows one row per pair across **every** accepted friendship — not scoped to a single friendship.
- Each row carries a friend-name label "with {name}" / "mit {name}" below the tour-pair line.

### O3. Request link from embedded view

**Action:** Tap "Request to link" on a row.

**Expected:**
- Request fires (`create_link_request`), Jakob receives a push (action `link_created`), row disappears from Patrick's list.
- Other rows for the same friend stay (independent pairs).

### O4. Back closes embedded view and restores Friends tab

**Action:** Tap the back arrow in the embedded view header.

**Expected:**
- Embedded view closes.
- The My Tours list reappears in the same sheet on the **Friends** tab.
- Prior search query, filter selections, and scroll position are preserved (because the underlying tab state never unmounted).

### O5. Empty state

**Setup:** Either (a) Patrick has no friends with colliding tours, or (b) all collisions are already linked or have pending requests.

**Action:** Open the embedded backfill view via the button.

**Expected:**
- Empty-state copy "No tour overlaps with friends to review." / "Keine Tour-Überschneidungen mit Freunden zu prüfen." renders.

### O6. Digest deeplink route still works (regression)

**Action:** From a digest-style push (or manually navigate to `/friends/<friendshipId>/backfill-collisions`).

**Expected:**
- The full-page route still renders.
- Back button (top-left arrow) calls `router.back()` (route mode — there is no `@back` listener wired in this surface).
- Page shows the per-friendship pair list (NOT the all-friendships scan) and does NOT render friend-name labels per row (since all pairs share the same friend).

---

## Group P — My Tours tab persistence across sessions (Issue 2)

### P1. Selected tab survives full reload

**Action:**
1. Open My Tours list, switch to **Friends** tab.
2. Hard-reload the page (`Cmd-Shift-R` / `Ctrl-Shift-R`).
3. Reopen My Tours list.

**Expected:**
- The list opens directly on the **Friends** tab.
- `localStorage.getItem('tours.list.activeTab')` returns `"friends"` in DevTools console.

### P2. Selected tab survives PWA cold start

**Action (if PWA installed):**
1. Switch to **Owned** tab.
2. Kill the PWA process (close the standalone window completely).
3. Reopen the PWA.

**Expected:**
- The My Tours list opens on **Owned**.

### P3. Invalid stored value falls back to "owned"

**Action:** In DevTools console:
```js
localStorage.setItem('tours.list.activeTab', 'garbage')
location.reload()
```

**Expected:**
- App opens; My Tours list shows the **Owned** tab.
- No console errors. The bad value remains in storage until the next tab change overwrites it (acceptable — it's ignored on read).

### P4. Storage unavailable does not crash

**Action (Safari private mode):**
1. Open the app in Safari Private Browsing (`localStorage.setItem` throws `QuotaExceededError`).
2. Switch tabs in My Tours.

**Expected:**
- App does not crash; no unhandled errors logged.
- Tab change works in-memory only; will not persist after reload (expected limitation).

---

## Cleanup

After all testing, wipe link state + test tours and re-ensure friendships:

```sql
delete from public.tour_link_request;
delete from public.tour_link_member;
delete from public.tour_link_group;
delete from public.tours where user_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');

insert into public.friendships (request_user_id, response_user_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222',   '44444444-4444-4444-4444-444444444444'),
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444')
on conflict do nothing;
```

The three accounts and their profiles are preserved.
