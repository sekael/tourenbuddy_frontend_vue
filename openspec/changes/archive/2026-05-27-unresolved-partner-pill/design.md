## Context

Friend-tour partner display resolves partner contacts to confirmed-phone registered users via the chain `tour_partners → contact_methods (phone) → auth.users (phone_confirmed_at)`. `tour_partner_user_ids(tour_id)` performs this resolution; `tour_partner_names(tour_id)` returns the profile names of the resolved set, gated so only a partner-friend of a friends-visible tour can read it. The `friend_tours_view` exposes `partner_names` only when the viewer `is_partner`; non-partner friends get `[]` and no partner UI at all.

Partner contacts that do **not** resolve (no app account, or phone not confirmed) are dropped silently. The viewer never learns those partners exist. This change surfaces a privacy-safe **count** of those unresolvable partners so the info sheet can render a single generic "and X more" pill.

Decisions already settled with the user:
- Audience: **partner-viewers only** — same gate as `partner_names`. Non-partner friends still learn nothing.
- Semantics: X = count of **partner contacts** with no confirmed-phone registered user (unresolvable), not "all partners minus names shown".

## Goals / Non-Goals

**Goals:**
- Expose `unresolved_partner_count` from `friend_tours_view`, gated identically to `partner_names`.
- Render one generic pill "and X more" in the friend-partner block when X ≥ 1.
- Keep the resolution definition consistent with the existing phone-confirmation chain.

**Non-Goals:**
- Exposing any identity (name, contact, phone) of unresolved partners.
- Changing what non-partner friends see (still nothing).
- Changing own-tour reads or RLS row authorization.
- De-duplicating the edge case where two resolved contacts map to one user (see Risks).

## Decisions

### D1 — Count unresolvable contacts in the view, gated to `is_partner`
Add a column to `friend_tours_view`:

```sql
case when p.is_partner then public.tour_unresolved_partner_count(t.id) else 0 end
  as unresolved_partner_count
```

Introduce a tour-scoped `SECURITY DEFINER` resolver `tour_unresolved_partner_count(p_tour_id uuid) returns int` that **reuses the same authorization guard** as `tour_partner_names` (friends-visible, caller is a partner, friendship with owner exists), then returns:

```
count(distinct tp.contact_id)  -- total partner contacts
  minus
count(distinct tp.contact_id) that resolve to a confirmed-phone user
```

i.e. `count` of `tour_partners.contact_id` for which **no** matching `contact_methods` phone row joins a `phone_confirmed_at IS NOT NULL` user. Returns 0 when the caller is not authorized — defense in depth even though the view already gates on `is_partner`.

**Why a definer function over an inline subquery in the view:** the view is `security_invoker`, so an inline count would run under the caller's RLS and could not see other users' `contact_methods`/`auth.users`. The existing `tour_partner_names` already solved this with a definer resolver; mirroring it keeps one authorization pattern. **Alternative considered:** expose `total_partner_count` and let the client subtract `partnerNames.length`. Rejected — client subtraction is wrong when one user resolves from multiple contacts (see Risks), and it splits the privacy guard across two layers.

### D2 — Count contacts, not users
Unresolved = partner **contacts** that resolve to zero confirmed users. This is the natural reading of "partners we couldn't show you" and avoids leaking how resolved users distribute across contacts.

### D3 — Schema mapping
`friendTourRowSchema`: add `unresolved_partner_count: z.number().int().nonnegative().default(0)` → `unresolvedPartnerCount`. `tourSchema`: add optional `unresolvedPartnerCount: z.number().int().nonnegative().optional()`. `tourRowSchema` (own tours) untouched — own view never sets it; consumers treat undefined/0 as "no pill".

### D4 — Pill rendering
In `tour-info-sheet.vue`, the existing `v-if="tour.isFriendTour && friendPartnerNames.length > 0"` block renders named chips. Append a single pill when `unresolvedPartnerCount > 0`. The pill uses a pluralized i18n key, e.g. `t('tours.infoSheet.morePartners', unresolvedPartnerCount, { count: unresolvedPartnerCount })`.

Open question O1 covers the case where the named list is empty but unresolved > 0 (all partners unresolvable) — the block's `v-if` would currently hide the pill.

## Risks / Trade-offs

- **Multi-contact → one user.** If two partner contacts both resolve to the same registered user, `partner_names` shows one name but both contacts are "resolved", so neither counts as unresolved — correct. The reverse (one contact, no user) is the only thing counted. No double-count risk because the count keys on `contact_id`. → Acceptable; documented.
- **Count drift vs names.** `partner_names` is distinct users; the unresolved count is distinct contacts. In the rare multi-contact-one-user case the two cardinalities aren't simply additive, but the pill only reflects the unresolvable set, which is unaffected. → No mitigation needed; never overstates hidden people.
- **New definer function = new attack surface.** Mitigated by replicating the exact `tour_partner_names` guard (visibility + partner + friendship) and returning 0 on failure. → Guard tested in specs.
- **Showing a non-zero count is itself information.** A partner-viewer learns "N partners couldn't be shown." This is intended and scoped to partner-viewers only. → Consistent with settled audience decision.

## Migration Plan

1. New migration `supabase migration new add_unresolved_partner_count` — create `tour_unresolved_partner_count`, `create or replace view friend_tours_view` re-emitting all existing columns plus the new one. **Never edit prior migrations.**
2. `supabase db reset` locally, verify count for a tour with mixed resolved/unresolved partners.
3. Schema + UI + i18n changes, `npm run test`, `npx eslint . --fix`.
4. Rollback: a follow-up migration `create or replace view` without the column and `drop function tour_unresolved_partner_count`. View change is non-breaking (additive column), so rollback is low-risk.
5. `supabase db push` to prod only after review (prompt user).

## Open Questions

- **O1:** When every partner is unresolvable (named list empty, count > 0), should the pill still show? Current friend-partner block is gated on `friendPartnerNames.length > 0`. Leaning yes — render the block when `friendPartnerNames.length > 0 || unresolvedPartnerCount > 0` so "and 2 more" appears even with no names. To confirm during apply.
