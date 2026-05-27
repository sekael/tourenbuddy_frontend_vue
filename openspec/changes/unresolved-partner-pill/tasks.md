## 1. Branch

- [x] 1.1 Continue on `feat/85-friend-tour-visibility` (this change depends on its unmerged `friend_tours_view`/resolvers), OR branch from it if that work is mid-review — do NOT branch from `main`, which lacks the view.

## 2. Database (new migration — never edit existing migrations)

- [x] 2.1 `supabase migration new add_unresolved_partner_count`
- [x] 2.2 Add `tour_unresolved_partner_count(p_tour_id uuid) returns int` — `security definer`, `set search_path to ''`, stable. Reuse the exact authorization guard from `tour_partner_names` (friends-visible + caller is partner + friendship with owner); return 0 on guard failure.
- [x] 2.3 In the function body, count distinct `tour_partners.contact_id` for the tour that have NO matching `contact_methods` phone joining a `phone_confirmed_at IS NOT NULL` user. Mirror the `ltrim(value,'+')` + confirmed-phone join from `tour_partner_user_ids`.
- [x] 2.4 `grant execute` on the function to `authenticated` and `service_role`.
- [x] 2.5 `create or replace view public.friend_tours_view` re-emitting every existing column unchanged, plus `case when p.is_partner then public.tour_unresolved_partner_count(t.id) else 0 end as unresolved_partner_count`. Re-grant `select` to `authenticated`.
- [x] 2.6 `supabase db reset`; verify the count locally for a tour with mixed resolved/unresolved partners, and that a non-partner viewer gets 0.

## 3. Data layer

- [x] 3.1 `friendTourRowSchema`: add `unresolved_partner_count: z.number().int().nonnegative().default(0)` and map to `unresolvedPartnerCount` in the transform.
- [x] 3.2 `tourSchema`: add `unresolvedPartnerCount: z.number().int().nonnegative().optional()`. Leave `tourRowSchema` (own tours) untouched.

## 4. Presentation (tour-info-sheet.vue)

- [x] 4.1 Resolve Open Question O1: render the friend-partner block when `friendPartnerNames.length > 0 || (tour.unresolvedPartnerCount ?? 0) > 0` so the pill shows even when all partners are unresolvable.
- [x] 4.2 Append a single generic pill after the named chips, shown only when `(tour.unresolvedPartnerCount ?? 0) > 0`, using a distinct style from named chips.

## 5. i18n

- [x] 5.1 Add a pluralized key (e.g. `tours.infoSheet.morePartners`) to `en.json` AND `de-CH.json`. EN: "and {count} more" / pluralized; DE-CH equivalent. Render via `t(key, count, { count })`.

## 6. Tests

- [x] 6.1 Schema test: `friendTourRowSchema` maps `unresolved_partner_count` → `unresolvedPartnerCount`, defaults to 0 when absent.
- [x] 6.2 Component test (tour-info-sheet): pill renders "and 2 more" when `unresolvedPartnerCount = 2`; no pill when 0; no pill on own (non-friend) tour. Cover the all-unresolvable edge (empty names + count > 0).

## 7. Verify & ship

- [x] 7.1 `npm run test` — all pass.
- [x] 7.2 `npm run type-check`.
- [x] 7.3 `npx eslint . --fix`, then check diff size (editor format-on-save can fight antfu style).
- [x] 7.4 Prompt user to commit with a conventional message; do not commit automatically. Do NOT run `supabase db push` until reviewed.
