## Context

The signed-out flow is three routes deep: `/` (`home-page.vue` — background, title,
subtitle, one button) → `/auth/email` (`email-entry-page.vue` — email form) →
`/auth/verify-otp` (`verify-otp-page.vue` — 6-digit code). Only the first screen has the
hero background; the other two render a flat `--color-background` surface with a 400px
column. `email-entry-page.vue` and `verify-otp-page.vue` carry identical `.page` and
`.card` rules — the same nine declarations, duplicated.

The router guard treats all three as `redirectIfAuth: true`, so an authenticated user
never sees any of them. `main.ts:73` (post-sign-out) and `user-profile-sheet.vue:233`
(sign-out action) both navigate by name to `home`, not by path — so as long as the route
named `home` keeps existing at `/`, neither caller changes.

Issue #260 asks only that the CTA step disappear and the background stay. The layout
duplication is pre-existing; it becomes worth fixing now only because the fix would
otherwise create a third copy.

## Goals / Non-Goals

**Goals**
- A signed-out user landing on `/` can type their email and submit without any
  intermediate navigation.
- The hero background is continuous across the whole signed-out flow — no backdrop
  change between entering the email and entering the code.
- Zero new i18n keys; the retired copy is deleted from every locale.
- The email-entry behaviour (validation, error surfacing, OTP dispatch, navigation)
  is byte-for-byte the behaviour that exists today.

**Non-Goals**
- No change to auth mechanics: `signInWithOtp`, the locale metadata, the OTP redemption,
  and the auth store are untouched.
- No change to router guard logic (`requiresAuth` / `redirectIfAuth` /
  `requiresCompleteProfile` all behave as they do today).
- No redesign of the OTP screen's contents — it gets the hero wrapper and a corrected
  back target, nothing more.
- No new landing-page marketing content (feature list, screenshots, install prompt).

## Decisions

### D1 — Merge the form into `/`, delete `/auth/email`

The form moves into `home-page.vue`; the `email-entry` route and page are removed.

- *Why not redirect `/` → `/auth/email`?* It keeps a hop, just an invisible one. `/` is
  the PWA `start_url`; making it a route that never renders means every cold launch
  paints a redirect. Landing directly is the thing the issue asks for.
- *Why no `redirect: '/'` stub for `/auth/email`?* Nothing links to it. It is not in any
  outbound email (the OTP mail contains a code, not a link — magic links were removed),
  not in the manifest, not in a share target. A stub route is dead config that outlives
  everyone's memory of why it exists.
- *Consequence:* a stale bookmark on `/auth/email` hits the router's no-match behaviour.
  Accepted: the URL existed only as the destination of a button being deleted.

### D2 — One shared `auth-hero-layout.vue`, not two copies of the CSS

The background `<picture>`, overlay, hero `<h1>`, safe-area padding, and translucent
card become a single component with a default slot.

- *Why extract rather than paste?* The two pages already duplicate the layout CSS; the
  hero would make it three copies of a longer block. One component, two consumers is the
  smallest total diff and the only version where a padding tweak can't drift between the
  two screens.
- *Why a slot and not props?* The pages differ in their entire body (form vs. OTP form +
  resend). A slot is the whole API; anything more is speculative.
- *Boundary check:* `features/auth/presentation/components/` is the correct home —
  it is auth-specific chrome, not a `core/` primitive, and nothing outside `auth` uses it.

### D3 — Translucent card, opaque inputs

The card is `color-mix(in srgb, var(--color-surface) 88%, transparent)` with a
`backdrop-filter` blur; the `<input>` keeps its solid `--color-background` fill.

- *Why not a fully transparent form on the overlay?* Input affordance and contrast on a
  photographic backdrop is fragile — a light patch of snow behind a light input field is
  a real failure mode, and it varies by viewport because the two background assets crop
  differently.
- *Why 88% and not blur alone?* `backdrop-filter` is broadly supported but not
  universally; at 88% opacity the card is legible with the blur ignored, so no
  `@supports` fallback branch is needed.
- The existing dark gradient overlay stays — it is what makes the white hero `<h1>`
  legible, and it also flattens the range the card sits on.

### D4 — Hero `<h1>` is the page's only `h1`; in-card titles become `<h2>`

`auth.emailEntry.title` and `auth.verifyOtp.title` currently render as `<h1>`. With the
hero title present they would be a second `h1` on the same page.

- *Why it matters:* screen-reader users navigate by heading level; two `h1`s on one page
  makes the document outline ambiguous. This costs one character per page.
- The `.title` class is unchanged, so the visual size does not move.

### D5 — Retire the whole `auth.home` block, add nothing

`auth.home.getStartedBtn` has no remaining consumer. `auth.home.subtitle` ("Plan outdoor
adventures with friends") also goes: with the card carrying `auth.emailEntry.title` +
`auth.emailEntry.subtitle` directly beneath the hero, keeping the marketing subtitle
stacks three lines of copy above a one-field form.

- *Why not keep the subtitle and drop the card copy instead?* The card copy is
  functional ("We'll send you a sign-in code") — it sets the expectation that no password
  is coming and that an email is about to arrive. The marketing line is not.
- Both `en.json` and `de-CH.json` lose the same block, keeping the files key-identical.

### D6 — Test only the failure paths

Per `.claude/testing.md`: a new `home-page.test.ts` asserts (a) an invalid email shows the
validation error and never calls `authStore.sendEmailOtp`, and (b) a rejected
`sendEmailOtp` surfaces the error message and does not navigate. The success path is not
asserted. `verify-otp-page.test.ts`'s back-navigation assertion is retargeted to `home`.

- *Why no test for the layout component?* It is presentational — a background, an
  overlay, and a slot. A snapshot of it would assert CSS, which is what the manual check
  is for.

## Risks / Trade-offs

- **Stale `/auth/email` links 404.** Accepted (D1). Mitigation if it ever bites: a
  one-line `redirect` route, addable later without touching anything else.
- **Card contrast over an unknown photo region.** Mitigated by the overlay + 88% opaque
  card + opaque inputs; must be eyeballed on both breakpoints (the mobile and desktop
  assets crop to different parts of the image) and in an installed iOS PWA where the
  safe-area padding differs.
- **Two background images now load on the OTP route too.** They are already bundled and
  cached by the PWA precache from the landing page the user just came from; the second
  route is a cache hit, not a download.
- **Behaviour regression risk in the moved form.** The form logic is moved, not rewritten
  — same regex, same store call, same query param, same error handling. The new
  failure-path tests cover the two branches that can silently break.

## Migration Plan

Single PR, no phasing, no feature flag — the change is client-only and self-contained.
Deleting the route, deleting the page, and rewriting the two remaining pages must land
together, since `verify-otp`'s back button would otherwise point at a route that no
longer exists. No DB migration, no Worker deploy, no env var.

## Open Questions

None — route shape (D1), card treatment (D3), OTP-page background (D2), and copy
(D4/D5) were all resolved with the issue author before this proposal.
