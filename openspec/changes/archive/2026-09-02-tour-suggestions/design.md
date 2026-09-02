## Context

Every write path today is owner-scoped. The relevant sites:

| layer | site | today |
|---|---|---|
| tour rows | `tours` RLS, `create/update_tour_full` | owner only (`auth.uid()`) |
| `updated_at` | `set_updated_at` BEFORE UPDATE trigger — `20260811085649:26` | stamped on **any** update |
| friend refetch | `fn_broadcast_friend_tour_change` AFTER trigger — `20260608062416` | fires on any `tours` write |
| tour reads for friends | `friend_tours_view` (`20260527165812:63`) | partner-gated SELECT |
| partner resolution | `tour_partner_user_ids(uuid)` SECURITY DEFINER — `20260526052115:34` | live, no link table |
| attachments | `tour_attachments` RLS (`20260524033946:24-43`) + partner SELECT (`20260526204120:12`) | owner writes, partner reads |
| storage | `tour-gpx` / `tour-attachments` policies | `split_part(name,'/',1) = auth.uid()` |
| GPX replace | `tours-store.ts:495-503` | old object deleted after write, orphan warned |
| aggregate-reconcile precedent | `update_contact_full` — `20260811100000` | one idempotent call reconciles a child set |
| handshake precedent | `tour_link_request` + 4 definer RPCs (`20260528062747`) | the RPC pattern to mirror |
| void precedent | `20260530120000_void_pending_requests_on_predicate_break.sql` | trigger voids pending rows |
| offline seam | `mutate()` — `src/core/offline/mutate.ts:82` | queue or run directly |

Four facts shape the decisions:

1. **Partner status is derived live, never materialized.** It can evaporate between
   suggesting and accepting (contact loses its phone, friendship removed, tour goes
   private). Every RPC re-checks, and pending rows are voided when it breaks.
2. **Realtime `postgres_changes` filters cannot join.** A filter is one column on one
   table. The tour owner cannot be reached by a filter on `tour_id`.
3. **Storage policies are prefix-based on the caller's uid.** A suggester writing into the
   owner's prefix is impossible without weakening the owner's own isolation.
4. **`update_tour_full` is a full-row overwrite.** Omitted args null their columns, and it
   does `delete from public.tour_partners` then re-inserts (`20260811093000:141-167`).

## Goals / Non-Goals

**Goals**

- A partner proposes changes to any tour field except `visibility` and `completed`.
- The owner adjudicates per field, or accepts a whole review at once.
- The tour is byte-identical until an accept; no partial or invalid intermediate state.
- The author can revise a proposal until it is resolved; resolution is final.
- The record of what was proposed and how it was resolved survives.
- Zero regression to owner-only write isolation on rows and Storage objects.

**Non-Goals**

- Offline suggest/accept (D6). Offline *reads* are in scope (D14).
- Threaded comments, counter-suggestions, or editing another user's suggestion.
- Suggestions on the partner set (structurally impossible — see D2), visibility, or completion.
- A global cross-tour suggestions inbox (D15).
- Any change to how non-partner friends read tours.

## Decisions

### D1 — One row per logical field, not a draft patch and not a shadow tour

```sql
create table public.tour_suggestion (
  id            uuid primary key default gen_random_uuid(),
  tour_id       uuid not null references public.tours(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,  -- D8
  suggester_id  uuid not null references auth.users(id) on delete cascade,
  batch_id      uuid not null,
  field         text not null check (field in (...)),   -- D2
  value         jsonb,          -- null is a legitimate suggestion ("clear this field")
  base_value    jsonb,          -- what the suggester saw — D4
  target_id     uuid,           -- attachment_remove only — D3
  status        text not null default 'pending'
                check (status in ('pending','accepted','declined','withdrawn')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
grant all on table public.tour_suggestion to anon, authenticated, service_role;

-- D13: at most one pending suggestion per author per field per tour
create unique index tour_suggestion_one_pending_per_field
  on public.tour_suggestion (tour_id, suggester_id, field, coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'pending';
```

Accept/decline is per field, so the field **is** the aggregate. Status lives on the row;
there is no second place to record resolution.

Rejected — **one draft row with a jsonb patch**: per-field resolution then needs a parallel
`{field: status}` map or a child table, i.e. the same row count with an extra join and a
consistency invariant (patch keys ⟷ status keys) that nothing enforces.

Rejected — **shadow tour row mirroring `tours`**: "unchanged" and "explicitly cleared to
null" are indistinguishable without a `touched text[]` — which is the field list again,
just denormalized and unconstrained.

`value` is nullable **on purpose**: "remove the description" is a real suggestion. The
absence of a suggestion is the absence of a row, not a null value.

### D2 — `field` is a logical field; coupled and derived columns travel together

```
name | dates | goal | tour_type | elevation | description | seasons
| equipment | notes | start_point | end_point | gpx
| attachment_add | attachment_remove
```

- `dates` carries `{plannedDate, endDate}` as one unit. Splitting them lets an owner accept
  a new `end_date` against an unchanged `planned_date` and trip
  `tours_end_date_after_start` (`20260825131243`) — a constraint error surfaced to a user
  who did nothing wrong.
- `start_point` / `end_point` carry `{lng, lat, name, elevation}`. Name and elevation are
  *derived from* the coordinates by the Swisstopo services; accepting a coordinate without
  its name leaves a label describing the old place.
- **`goal` carries its derived `elevation` when the coordinates move.** Elevation is looked
  up from the goal point, but is also independently editable, so it is its own logical
  field *only* when edited alone. The diff decides: coordinates moved ⇒ emit `goal`
  carrying the freshly-looked-up elevation and emit no standalone `elevation`; elevation
  edited alone ⇒ emit `elevation`. Without this, "accept the new summit, decline the new
  altitude" is a reachable tap sequence that produces wrong data about a mountain.
- `visibility` and `completed` are absent from the enum, not merely filtered client-side.
  Visibility is the privacy control itself; completion is the owner's factual assertion
  about their own day.
- **The partner set is structurally unsuggestable.** `tour_partners.contact_id` references
  the *owner's* `contacts` rows; a suggester's contact ids are meaningless in that
  namespace, and `friend_tours_view` returns `partnerIds: []` to a friend viewer by
  construction. The partner picker is hidden in suggest mode rather than diffed.

The enum is duplicated in exactly two places — the SQL CHECK and `tour-suggestion.ts`'s Zod
enum — and a test reads the migration to assert they match.

### D3 — Binary suggestions are ops in the same table

- `gpx` — `value = {storagePath, ...}`, replace semantics on `tours.gpx_filepath`. A null
  value means "remove the track".
- `attachment_add` — `value = {storagePath, mimeType, sizeBytes, originalFilename}`,
  `target_id` null.
- `attachment_remove` — `target_id` = existing `tour_attachments.id`, `value` null.

An add and a remove are separate rows, so the owner may take the new photo without losing
the old one. Several `attachment_add` rows may coexist and all be accepted; D7's
auto-decline is scoped per `(field, target_id)`, so two adds never cancel each other.

Accepting an `attachment_remove` deletes the row and the owner's object through the
existing attachment delete path. A remove whose `target_id` is already gone resolves
`accepted` with no work — the intent was satisfied.

On accepting a `gpx` suggestion the previous object is deleted with an orphan warning,
reusing the existing replace path (`tours-store.ts:495-503`).

Rejected — **a separate `tour_attachment_suggestion` table**: duplicates status, batch,
resolution and notification logic, and forces the review sheet to merge two ordered
streams into one batch view.

### D4 — `base_value` for staleness; the owner decides, nothing auto-voids

Each row stores the value the suggester was looking at. At review time:

| current tour value | vs `base_value` | rendering |
|---|---|---|
| equal | — | clean suggestion, two-column diff |
| differs | — | **stale**: three columns (current / what they saw / suggested) |

Accepting a stale suggestion is allowed — it is a deliberate overwrite of the owner's own
newer edit, made with the divergence on screen. Editing a suggestion refreshes its
`base_value` (D12), so a just-revised proposal never renders as stale.

Rejected — **auto-void on owner edit** (the `20260530120000` trigger pattern): correct for
a link handshake, where the collision predicate is a fact about the world, but wrong here.
A friend's proposal is an opinion; the owner touching an adjacent word should not silently
discard it.

### D5 — Accept applies via a targeted UPDATE inside the definer RPC

`updated_at` is stamped by the `set_updated_at` BEFORE UPDATE trigger (`20260811085649:26`)
and the friend-tour broadcast fires from its own AFTER trigger (`20260608062416`). **Both
happen on any update to `tours`**, so neither depends on routing through `update_tour_full`.

The accept RPC therefore does a targeted `update public.tours set <columns> where id = ...`,
selected by a `CASE` on `field`. It carries its **own explicit owner gate**, because
SECURITY DEFINER bypasses RLS and that gate is then the only one — written exactly as
`update_tour_full:127` writes it.

Rejected — **calling `update_tour_full`**: it is a full-row overwrite (fact 4), so a
one-field accept would have to reconstruct all 21 arguments from the current row, including
`ST_AsText` round-trips on three geography columns, and would `delete from tour_partners`
and re-insert them on every accept. All of that to obtain an `updated_at` stamp the trigger
already provides.

"Accept all" for a batch runs inside one RPC call, i.e. one transaction, one `updated_at`
bump and one broadcast, not N.

### D6 — Suggestion writes are online-only

Create, edit, accept, decline and withdraw gate on the `isOnline` signal, exactly as tour
attachments do (DC10).

Offline suggestions would need a `kind→handler` replay registration per action, coalescing
keyed on `(tour, field, author)`, and a conflict rule composing offline LWW with suggestion
staleness (D4) — two independent notions of "the base moved" resolved against each other.
The feature's value is a conversation between two online people; queuing one side of it for
a day is not obviously desirable even once it works.

### D7 — Accepting a field auto-declines its siblings

When a suggestion is accepted, every other `pending` suggestion on the same tour with the
same `(field, target_id)` is resolved `declined` with `resolved_at = now()` in the same
transaction, regardless of author, and each affected author's batch runs the completion
check of D10. Their `base_value` is now definitively stale and their proposals were written
against a value that no longer exists; leaving them pending makes the owner adjudicate the
same field twice for no new information.

### D8 — Denormalized `owner_id` exists for Realtime, and simplifies RLS

Realtime filters cannot join (fact 2), so the owner cannot subscribe to "suggestions on my
tours" via `tour_id`. `owner_id` is written by the create RPC from the tour row and gives
both sides a user-scoped filter on one channel:

```
{ event: '*', table: 'tour_suggestion', filter: `owner_id=eq.${uid}` }
{ event: '*', table: 'tour_suggestion', filter: `suggester_id=eq.${uid}` }
```

It is also the SELECT policy — `owner_id = auth.uid() or suggester_id = auth.uid()` — with
no subquery, which matters because that predicate runs on every row of every read. And it
is the store's single load query (D15), so one expression serves policy, filter and fetch.

Safe because tour ownership is immutable: no code path transfers a tour, and `tours.user_id`
has no UPDATE path in either RPC. `on delete cascade` covers tour deletion.

Per architecture rules the store MUST provide `onSubscribed` doing a full refetch — the
channel tears down while the tab is hidden and events in that window are lost.

### D9 — Staged blobs live in the suggester's own prefix and are copied on accept

The suggester uploads to `<suggester_uid>/suggestions/<tour_id>/<uuid>`. The first path
segment is their own uid, so the **existing** owner-insert policy already permits it — no
new INSERT policy, no weakening of anyone's isolation. Two additions only:

1. A SELECT policy letting the tour owner read objects referenced by a *pending* suggestion
   on their tour, so the review sheet can render the proposed file.
2. On accept, the owner's client issues `storage.from(bucket).copy(staged, ownPath)` — a
   server-side copy needing read on the source (policy 1) and insert on the destination
   (existing owner policy) — then passes the new path to the accept RPC.

Cleanup splits by who can delete what: the **suggester's** store sweeps staged objects for
its own resolved suggestions on load (only they hold delete rights on their prefix); the
owner's copy follows the existing attachment lifecycle.

Rejected — **no copy, grant access by row join**: cheaper, but the blob's lifetime then
belongs to a non-owner who can delete an accepted attachment's bytes out from under the
tour. Guarding that needs an `AS RESTRICTIVE` delete policy on `storage.objects`, which
applies to *every* delete in the bucket including the owner's existing flows and silently
depends on delete-row-before-object ordering.

Rejected — **doing the copy in the `email-hook` Worker** with service-role credentials
(one server-side call, no owner-read policy needed for the copy): it puts the Worker in the
**data path**, and the Worker is not deployed by CI. A forgotten `wrangler deploy` today
degrades to "no notification"; under that design it would degrade to "accepts fail".

Known ceiling: a crash between the copy and the accept RPC orphans one object in the
owner's prefix; the suggestion stays `pending` and a retry re-copies. Same exposure as the
existing upload-then-write window in the attachment picker.

### D10 — Batch order is fixed; the cap is evaluated on the end state

A batch accept applies **removes, then scalars, then adds**, all in one transaction, and the
5-attachment cap (`check_tour_attachment_limit`, `20260524033946:47`) is evaluated against
the **post-remove** count. So "drop the blurry photo, use this one" succeeds in one tap on a
tour already holding five. A genuine end-state breach raises the named error
`tour_attachment_limit_exceeded` before anything is written and resolves nothing — no
half-applied review. Determinism matters: the outcome must not depend on row order.

The review sheet disables accept on an `attachment_add` row while the tour is full, with a
hint to remove one first.

Rejected — **auto-decline on breach**: turns the owner's tap into a discard of a friend's
file, precisely what per-field adjudication exists to prevent.

### D11 — Partner status is re-checked at every step, and its loss voids pending rows

`tour_partner_user_ids` is consulted on create, on edit and on accept. A trigger mirroring
`20260530120000_void_pending_requests_on_predicate_break.sql` moves pending suggestions to
`withdrawn` when the predicate breaks — the partner set changes, the friendship is removed,
or the tour goes `private`. Without it the owner sees proposals from someone who can no
longer see the tour they refer to. Voiding is silent (D16).

### D12 — Editing a pending suggestion reconciles the whole batch

The author may revise until resolution; resolved rows are immutable and a further change
means a new batch.

Revision reopens the form seeded with **their pending suggested values**, and submit calls
one definer RPC, `upsert_tour_suggestions(p_tour_id, p_batch_id, p_items)`, which
reconciles the author's pending set against the desired set:

- field still differs from the original → update in place, **refresh `base_value`**
- newly-changed field → insert into the same batch
- field reverted to the original value → `withdrawn`

`on conflict` targets D13's partial unique index, so a double-tapped submit is idempotent.

This is the `update_contact_full` pattern (`20260811100000`): an aggregate whose every
mutation is ONE idempotent call reconciling the child set, never a multi-write sequence
reconciled on the client.

Rejected — **per-row inline edit** (`update_tour_suggestion(p_id, p_value)`): simpler RPC,
but the author revises in a different UI than they authored in, and *adding* a field to an
existing batch still needs the form — so both paths exist anyway.

### D13 — One pending suggestion per author per field, enforced in the database

The partial unique index in D1 makes D12's reconcile model an invariant rather than a UI
convention: it kills duplicate rows from a retried submit on a flaky connection, gives the
upsert its `on conflict` target, and spares D7's auto-decline from reasoning about two
pending rows from the same author on one field. Batch-level singularity follows from the
reconcile logic and needs no constraint of its own.

### D14 — Reads are cached offline; writes are not

Suggestions load through `cachedLoad` (`src/core/offline/cached-load.ts:37`) like every
other collection, and all four actions stay online-gated (D6). Without caching, an owner
opening a tour offline sees no pending indicator — which does not read as "unknown", it
reads as "nobody suggested anything". That silent false negative is the exact failure the
offline data cache exists to prevent everywhere else, and avoiding it costs about five
lines through an existing seam.

### D15 — One query for the whole feature; entry points are tour-scoped

The store loads **all rows where `owner_id = uid or suggester_id = uid`** — the same
predicate as the SELECT policy and the realtime filters (D8) — and derives a
`tourId → pendingCount` map from it. That one query feeds the tour-list-row indicator, the
info-sheet badge and the review sheet alike; there is no per-tour fetch.

Entry points: "Suggest changes" in the tour action bar on a friend tour where `isPartner`;
a pending indicator on owned tours in both the **tour list view** and the info sheet, plus
the history entry. No map affordance and no global inbox — the `tour_suggestions`
notification is the standing discovery channel, and an inbox is a clean follow-up change if
usage shows it is needed.

### D16 — One notification per batch, on both sides

- **Submit** → owner, once per batch, never per field. Other partners are not told.
- **Resolution** → author, once, fired on the transition to *fully resolved*: the RPC
  checks for remaining `pending` rows in the batch and dispatches only when there are none,
  summarising counts ("3 accepted, 1 declined"). A partially-resolved batch stays silent —
  the owner has not finished deciding — and the author still sees live state in-app through
  the realtime subscription. D7's auto-declines run the same completion check.
- **Edit** → nobody. The owner already knows the batch exists and has not acted; their
  review sheet updates live. An edit that adds fields to an already fully-resolved batch is
  by definition a new batch, and notifies as a fresh submit.
- **Withdraw** and **predicate-break void** → nobody.
- **Accept also dispatches the existing `tour_updates`** notification when the accepted
  field is in the meaningful set (`tour-notifications.ts:44`), to partners minus the actor
  and minus the suggestion's author — the author already has their `tour_suggestions`
  notification. If the meeting point moves because a partner suggested it, every other
  partner has the same need to know as when the owner moves it themselves.

Rejected — **one notification per resolved row**: worst case N pushes for one review
session, no upside.

## Risks / Trade-offs

- **Non-owner Storage writes are new ground.** Mitigated by D9 keeping every write inside
  the writer's own prefix, so the only new grant is a narrow, suggestion-scoped read.
- **Worker deploy is manual.** A forgotten `wrangler deploy` makes every suggestion
  notification a silent no-op — dispatch is fire-and-forget by design
  (`notify-dispatch.ts:29`). D9's rejection of the Worker-side copy keeps that failure mode
  bounded to notifications. The task list carries the deploy as an explicit step.
- **`tour-form.vue` is 1263 lines** and gains a mode. The diff logic lives in
  `use-suggestion-diff.ts`, not inline in the SFC, or the file becomes unreviewable.
- **Unbounded history.** Resolved rows are never deleted. At this app's scale that is a
  rounding error; a retention sweep is additive if it ever matters.

## Migration Plan

One migration, applied locally first (`supabase db reset`), pushed to prod only after
verification. Deploy order: migration → frontend → Worker. The frontend never calls an RPC
the migration did not create; the Worker endpoint is additive and its absence degrades to
no notification.

No backfill: the feature starts with zero rows.

## Open Questions

None — resolved across proposal review and the follow-up design interview.
