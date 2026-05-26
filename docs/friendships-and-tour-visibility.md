# Friendships & tour visibility

How TourenBuddy decides **who can see which tour, and how much of it** — plus the
friendship model it builds on and the notifications it emits. This is the
authorization design for the `friend-tour-visibility` change (issue #85).

## Friendship model

- **Identity is the verified phone.** A "user" you can befriend is an `auth.users`
  row with `phone_confirmed_at` set. A contact in your address book is _not_ a user
  reference — it's linked to a user only by matching its phone (`contact_methods.value`,
  normalized with `ltrim(value, '+')`) against `auth.users.phone`. The same
  normalization is used everywhere (`find_users_by_phones`, the cleanup triggers, and
  the `tour_partner_user_ids` resolver below).
- **`friend_requests`** holds pending/accepted/denied/cancelled requests between two
  verified users. On acceptance a row is written to **`friendships`**
  `(request_user_id, response_user_id)` — an undirected edge (match either column).
- **Blocking cleans up the edge.** `block` calls
  `terminate_pending_and_friendship_between`, deleting the friendship. Because every
  authorization rule below keys on the `friendships` table, a block instantly revokes
  tour visibility and stops shared-tour notifications — no extra bookkeeping.

## Per-tour visibility

`tours.visibility` is `text NOT NULL DEFAULT 'friends'` with
`CHECK (visibility IN ('private', 'friends'))` (mirrors the `tour_type` pattern;
extensible to `'public'` later).

- **`friends`** (default): readable by the owner's accepted friends.
- **`private`**: owner-only. Hidden from _everyone_, including users marked as partners.

Only the owner reads or changes it (the existing `tours_update_own` RLS policy). The
owner sets it on the create form and toggles it from the info sheet; `update_tour_full`
deliberately leaves `visibility` untouched so editing a tour never resets it.

## Authorization model — two layers

A read decision has two independent questions, enforced in two different places:

| Question     | "May I see this tour at all?"                                         | "May I see _these fields_?"                   |
| ------------ | --------------------------------------------------------------------- | --------------------------------------------- |
| Concern      | **row** access                                                        | **column / detail** gating                    |
| Enforced in  | **RLS policy on `tours`**                                             | **`friend_tours_view` body**                  |
| Rule         | accepted `friendship(owner, viewer)` **AND** `visibility = 'friends'` | viewer must be a **partner** on the tour      |
| Gated fields | —                                                                     | `planned_date`, `gpx_filepath`, partner names |

RLS is row-level — it cannot null individual columns — which is _why_ the gating lives
in the view, not the policy.

### Why `friend_tours_view` MUST be `security_invoker`

> **This is the load-bearing detail.** Get it wrong and everything leaks.

`friend_tours_view` is declared `WITH (security_invoker = true)`, so it runs with the
**caller's** privileges and the `tours_select_friend` RLS policy filters its rows.

A view _without_ `security_invoker` runs as its owner (`postgres`, a superuser) and
**bypasses RLS entirely**. If this view lost that flag it would return **every tour of
every user** — strangers included — and, because both the friendship check _and_ the
`visibility = 'friends'` check live only in the RLS policy, **private tours would leak
too**. The column gating in the view body would still run, but that's irrelevant once
every row is exposed.

**Predicate location determines blast radius:** know which layer enforces each
predicate, and you know exactly what leaks when a layer is removed.

### Why the partner resolver is `security_definer`

Resolving "is this viewer a partner?" must read the owner's _private_ `contacts` /
`contact_methods` — which the viewer cannot read under RLS. So
`tour_partner_user_ids(p_tour_id)` is `SECURITY DEFINER` (it bypasses RLS to traverse
that data). That power is **contained by its return shape**: it returns only `uuid[]`,
never contact rows, so no private contact data reaches the caller. The view compares
`auth.uid()` against that set to compute `is_partner`.

### Partner representation for friends

A friend never sees the owner's raw `contact_id`s (meaningless in their address book,
and the owner's non-registered contacts must not leak). The view returns
`partner_names` — the **registered-user** partners resolved to profile names via
`tour_partner_names(tour_id)` — and omits non-registered contacts. The owner's own view
(`tours_view`) is unchanged.

`tour_partner_names` is a **tour-scoped** `SECURITY DEFINER` resolver: it self-authorizes
(caller must be a partner on a `friends`-visible tour they are a friend of the owner on),
then returns the whole partner roster. It deliberately does **not** reuse the
friend-name lookup `get_user_names_by_ids`, which is **caller-relationship-scoped** —
that one only returns profiles the _caller_ is friends with and excludes the caller
itself. Tour co-partners are friends of the **owner**, not necessarily of each other,
so the caller-scoped predicate wrongly filtered the entire roster (the original bug).

### GPX files & attachments

The `tour-gpx` and `tour-attachments` buckets are otherwise owner-only
(`split_part(name, '/', 1) = auth.uid()`). Gating `gpx_filepath` in the view is not
enough — the object fetch itself is blocked. A storage `SELECT` policy on each bucket
lets a **partner-friend** of a `friends`-visible tour read the blobs (same friendship +
partner check), while non-partner friends and private tours stay blocked at the
storage layer.

Attachments add one extra layer: the `tour_attachments` **metadata rows** are themselves
RLS-guarded (originally owner-only), so a partner-friend also needs a table `SELECT`
policy with the same predicate — otherwise the strip queries zero rows and never even
reaches storage. Writes (insert/update/delete + reorder) stay owner-only; friends read.

## Read-decision flow

```
read a tour row
│
├─ I own it? ───────────────────────────────► FULL detail (tours_view)
│
└─ someone else's? (friend_tours_view, security_invoker)
   │
   ├─ friendship(owner, me) AND visibility='friends'?   ── no ─► NO ROW (RLS)
   │                                                            (private ⇒ owner-only)
   └─ yes ─► row returned
            │
            ├─ am I a partner?  (auth.uid() ∈ tour_partner_user_ids(id))
            │      │
            │      ├─ yes ─► FULL: planned_date, gpx_filepath, partner names
            │      └─ no  ─► GATED: those fields null/empty; name/location/type shown
```

### Partner-resolution chain (live, no materialized table)

```
tour_partners.contact_id
   └─► contacts.id                       (owner's private address book)
         └─► contact_methods (method_type='phone', value)
               └─► ltrim(value, '+')  ==  auth.users.phone   (phone_confirmed_at NOT NULL)
                     └─► auth.users.id   ← the registered partner user id
```

Resolved live on every read because `contacts` / `tour_partners` change independently
of `tours`; correctness beats the maintenance cost of a trigger-kept link table.

## Notifications

Two notification types ride the existing client→Worker fire-and-forget path
(`notify-dispatch.ts` → `services/email-hook`), honoring each recipient's
`notif_push_enabled` / `notif_email_enabled` / `notif_muted_types`:

- **`tour_updates`** — a shared tour you partner on was created / updated / deleted.
  Fired by the **owner**'s client; the Worker resolves recipients as
  `tour_partner_user_ids ∩ owner's friends − actor`. Only on a **meaningful** edit
  (name, planned date, goal, tour type, partners, GPX, description, equipment, or a
  completion flip) — cosmetic/owner-private fields (notes, elevation, seasons,
  start/end detail) and visibility changes never notify. Private tours notify no one.
  _Known limitation:_ the `deleted` notification is best-effort — the client fires it
  before deleting the row, but the Worker may lose the race and 404.
- **`tour_interest`** — a friend declined a duplicate-save and signaled interest. Fired
  by the **interested friend**; the Worker authorizes by an accepted friendship between
  caller and owner **and** `visibility='friends'`, then notifies the owner only. It does
  not re-verify the 100m collision or partner status (those are UX concerns).

## Map & list surfacing

- **Map**: own tours + friend tours you partner on (with a friendship indicator in the
  marker; non-partner friend tours never appear). A partner-friend tour within 100m of
  an owned tour is suppressed on the map (owned precedence) but stays in the list.
- **List ("My Tours")**: separate **Owned** / **Friends** tabs (default Owned, no merged
  list), each with independent search/filter. Non-partner friend tours show in gated
  form with an owner label and a "limited info" hint.

## Where it lives

- Migrations: `supabase/migrations/*_add_tours_visibility.sql`,
  `*_friend_tour_read_access.sql`
- RLS checks: `supabase/tests/friend_tour_visibility_rls.sql`
- Data: `src/features/tours/data/models/visibility.ts`, `…/tour-schema.ts`
- Domain: `src/features/tours/domain/{collision,tour-notifications}.ts`
- Worker: `services/email-hook/src/notify.ts` (`handleTourChanged`, `handleTourInterest`)
