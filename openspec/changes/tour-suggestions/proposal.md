## Why

Issue #268 (user feedback): TourenBuddy's stated purpose is *collaborative* planning, but
collaboration today is read-only. A friend marked as a partner on a tour sees the full,
ungated tour (`friend_tours_view`, `20260527165812`) and can do nothing with it. If the
turn-off is wrong, the meeting time is off, or the partner has the better GPX track, the
only channel is out-of-band chat and the owner retyping it.

Every write path in the app is owner-only by construction: `tours` RLS, both write RPCs
(`create_tour_full` / `update_tour_full` filter on `auth.uid()`), `tour_attachments`
write policies, and the `tour-gpx` / `tour-attachments` Storage policies
(`split_part(name, '/', 1) = auth.uid()`). Partner-friends hold **SELECT only** on all of
them (`20260526052115`, `20260526204120`).

So the feature is not "let partners edit". It is a proposal channel: a partner records
what they would change, the owner adjudicates, and only acceptance touches the tour.
The model is a GitHub PR review — several suggested changes submitted as one review,
each applied or rejected on its own.

## What Changes

- **New `tour_suggestion` table, one row per logical field.** Columns: `id`, `tour_id`,
  `suggester_id`, `batch_id`, `field`, `value jsonb`, `base_value jsonb`, `target_id`,
  `status`, `created_at`, `resolved_at`. Field is the accept/decline unit, so the field is
  the aggregate — no child table, no jsonb-of-accepted-keys bookkeeping (design D1).
- **`batch_id` groups one submit into one review.** The suggester edits N fields and
  submits once; the owner sees one coherent proposal with an "Accept all" affordance,
  and can still resolve any single row inside it.
- **`field` is a *logical* field, not a column** (design D2). Coupled and derived columns
  travel together — `dates` = `planned_date` + `end_date` (so a partial accept can never
  violate `tours_end_date_after_start`), `start_point` / `end_point` = lon + lat + name +
  elevation, and `goal` carries its looked-up `elevation` whenever the coordinates move.
  Enum: `name | dates | goal | tour_type | elevation | description | seasons | equipment |
  notes | start_point | end_point | gpx | attachment_add | attachment_remove`.
  `visibility` and `completed` are deliberately **not** suggestable; the partner set is
  structurally unsuggestable (`tour_partners.contact_id` lives in the owner's namespace).
- **Binary suggestions ride the same table** (design D3). `gpx` replaces `gpx_filepath`;
  `attachment_add` carries a staged-file descriptor in `value`; `attachment_remove` names
  an existing attachment in `target_id`. Non-owner uploads land in a **staging prefix**
  keyed by the suggester, needing new Storage INSERT/SELECT/DELETE policies — the first
  non-owner writes either bucket has ever taken.
- **`base_value` records what the suggester saw**, so the owner reviewing a suggestion on
  a field they have since edited themselves sees three columns — current, base, suggested —
  with the row flagged stale rather than silently overwriting their own newer edit (D4).
- **SECURITY DEFINER RPCs**, mirroring the `tour_link_request` handshake naming:
  `upsert_tour_suggestions` (whole batch, one idempotent reconciling call — create *and*
  revise), `accept_tour_suggestion`, `accept_tour_suggestion_batch`,
  `decline_tour_suggestion`, `withdraw_tour_suggestion`. Direct INSERT/UPDATE is blocked by
  RLS. Authorization: suggester must be a live partner via the existing
  `tour_partner_user_ids(uuid)` (`20260526052115_friend_tour_read_access.sql:34`) — no new
  link table. Owner-only accept/decline; author-only revise and withdraw.
- **The author may revise a pending suggestion until it is resolved** (D12). Resubmitting
  reconciles their pending set for that tour in one call — changed fields updated with a
  refreshed base, new fields inserted into the same batch, reverted fields withdrawn. This
  is the `update_contact_full` aggregate-reconcile pattern (`20260811100000`). Resolved
  rows are immutable; a further change means a new batch. A partial unique index enforces
  at most one pending suggestion per author per field (D13).
- **Accept applies via a targeted UPDATE inside the definer RPC** (D5). `updated_at` is
  stamped by the `set_updated_at` trigger and the friend-tour broadcast fires from its own
  trigger, so neither depends on `update_tour_full` — which is a full-row overwrite that
  would force a 21-argument reconstruction and needless `tour_partners` churn per accept.
  Accepting a field **auto-declines every other pending suggestion on that same field**
  (scoped per `(field, target_id)`, so concurrent attachment adds don't cancel each other).
- **Pending suggestions are visible to the owner and their author only.** Other partners
  see the unmodified tour, per the issue text. RLS: `suggester_id = auth.uid() OR tour
  owner = auth.uid()`.
- **Staleness is computed server-side by one builder** (D-staleness, see design D4):
  `tour_field_value(tour_id, field) returns jsonb` is the only thing that ever serialises a
  field, used both to write `base_value` and to expose `is_stale` on a
  `tour_suggestion_view`. Both sides of every comparison come from the same expression, so
  date/coordinate/null canonicalisation cannot drift and the client never compares anything.
- **Suggester composes in the existing `tour-form.vue` in suggest mode**: edited fields are
  diffed against the original on submit and become one batch. Visibility, completion and
  the partner picker are hidden; Save becomes "Suggest changes".
- **One review sheet, two modes.** The owner gets accept / decline per row plus batch
  accept-all; the author gets the same original-vs-suggested layout with **Withdraw** and a
  route back into the form to revise. Plus a **history view** of resolved suggestions
  (accepted/declined, by whom) — resolved rows are retained forever as the record.
- **Batch accept applies removes → scalars → adds** in one transaction, with the
  5-attachment cap evaluated on the **end state** (D10), so "swap this photo for that one"
  succeeds in one tap on a tour already holding five.
- **New `tour_suggestions` notification type** with its own mute toggle, one notification
  per batch on both sides (D16): the owner on submit, the author on the batch's transition
  to fully-resolved. An accept additionally dispatches the existing `tour_updates`
  notification to the *other* partners when a meaningful field changed. Requires
  `services/email-hook` changes and a **manual `wrangler deploy`** — the Worker is not in CI.
- **Writes online-only, reads cached** (D6, D14): all five actions gate on the `isOnline`
  signal like tour attachments (DC10) — no outbox handlers, no replay — while the rows load
  through `cachedLoad`, so an owner offline sees a stale-but-truthful pending count rather
  than a silent zero.
- **One query serves the feature** (D15): all rows where `owner_id = uid or suggester_id =
  uid` — the same predicate as the SELECT policy and the realtime filters — feeding a
  `tourId → pendingCount` map used by the tour list row, the info-sheet badge and the sheet.

Explicitly out of scope: suggestions on `visibility` or `completed`; suggestions from
non-partner friends; free-text comments or threaded discussion on a suggestion;
counter-suggestions/edit-in-place of someone else's suggestion; offline suggest/resolve;
suggestions on a tour's partner set; notifying other partners that a suggestion exists; a
global cross-tour suggestions inbox; any map affordance.

## Capabilities

### New Capabilities

- `tour-suggestions`: partner-authored, field-scoped change proposals on a friend's tour,
  with batch grouping, staleness tracking, owner adjudication, and retained history.

### Modified Capabilities

- `tour-attachments`: attachments and GPX gain a partner-writable **staging** path in
  Storage, with orphan cleanup on decline/withdraw; the 5-attachment cap gains a defined
  behaviour when an accept would breach it.
- `notifications`: the mutable type set gains `tour_suggestions`.
- `shared-tour-notifications`: the suggestion lifecycle (submitted / accepted / declined)
  becomes a dispatched event set with its own recipients.
- `friend-tour-visibility`: partner status, already the gate for reading detail, becomes
  the gate for *writing* a suggestion — stated explicitly so a lost partner link revokes
  the ability to suggest, and pending suggestions are voided.
- `tour-list-view`: an owned tour row surfaces a pending-suggestion indicator.

## Impact

- **DB**: one migration — `tour_suggestion` table + grants (Data API grants are mandatory
  for new public tables), CHECK constraints on `field`/`status`, the partial unique index,
  RLS policies, the `tour_field_value` builder, `tour_suggestion_view` exposing `is_stale`,
  five SECURITY DEFINER RPCs + execute grants, a void-on-predicate-break trigger
  (mirroring `20260530120000_void_pending_requests_on_predicate_break.sql`), realtime
  publication, and one new Storage SELECT policy per bucket for the staging prefixes on
  `tour-gpx` and `tour-attachments` (no new INSERT policy — the suggester writes under
  their own uid prefix, which the existing owner-insert policy already permits).
- **Code**: new `features/tours/data/models/tour-suggestion.ts` (Zod + field enum),
  `domain/entities/tour-suggestion.ts`, `domain/repositories/tour-suggestions-repository.ts`,
  `data/repositories/tour-suggestions-repository-impl.ts`,
  `presentation/stores/tour-suggestions-store.ts`,
  `presentation/composables/use-suggestion-diff.ts`, `tour-suggestion-review-sheet.vue`,
  `tour-suggestion-history-sheet.vue`, `tour-suggestion-row.vue`; modified
  `tour-form.vue` (suggest mode), `tour-info-sheet.vue` (entry points + pending badge),
  `tour-list-row.vue` (pending indicator), `notify-dispatch.ts`,
  `notification-preferences.ts`, `notification-preferences-section.vue`.
- **Worker**: `services/email-hook` gains a `/notify/tour-suggestion` endpoint and the
  `tour_suggestions` mute check. **Manual `npx wrangler@latest deploy` required** — not
  in CI; without it the endpoint 404s and dispatch silently no-ops.
- **Offline**: read-only. Suggestions hydrate through the existing `cachedLoad` seam; all
  five actions are gated on `isOnline`, so there are no write-queue or replay changes.
- **i18n**: new keys in `en.json` and `de-CH.json` for suggest mode, the review sheet,
  per-field labels, staleness, the cap error, the history view, and the new
  notification type label/description.
- **Risk**: medium. The novel surface is non-owner Storage writes — a staging prefix that
  a partner may write and the owner may read, without widening access to the owner's own
  objects. Everything else composes existing patterns.
