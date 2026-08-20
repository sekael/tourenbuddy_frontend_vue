## Why

Issue #260 (user feedback): the landing page at `/` is a dead end. It shows the hero
background, the product name, a subtitle, and a single **"Get Started"** button whose
only job is `router.push({ name: 'email-entry' })`. Every first-time and every
signed-out returning user pays an extra tap and an extra page load before they can do
the one thing the page exists for — type their email. The CTA carries no information
the next screen doesn't already carry.

Removing the intermediate step means the sign-in form lives on `/` itself, over the
same hero background. That also removes a whole route, a whole page component, and two
i18n keys per locale.

A second, smaller problem falls out of the fix: `email-entry-page.vue` and
`verify-otp-page.vue` today share byte-identical `.page` / `.card` layout CSS on a flat
`--color-background` surface. Once the sign-in form moves onto the hero background, the
OTP step would be the only auth screen without it — a visible flash of a different
backdrop mid-flow. Both auth screens get the hero, and the shared chrome is extracted
once instead of being pasted twice.

## What Changes

- **The email form moves onto `/`.** `home-page.vue` stops being a CTA screen and
  becomes the sign-in screen: hero background + `<h1>TourenBuddy</h1>` + the email form
  in a translucent card. The form logic (`emailRegex` validation, `authStore.sendEmailOtp`,
  navigation to `verify-otp` with the email query, loading + error state) moves over
  unchanged from `email-entry-page.vue`.
- **The `/auth/email` route and `email-entry-page.vue` are deleted outright** — no
  redirect stub. The URL was never linked from an email, a notification, or an external
  surface; it only ever existed as the destination of the button being removed.
- **`verify-otp-page.vue` back button repoints** from `{ name: 'email-entry' }` to
  `{ name: 'home' }`. Its own test asserts the old target and must change with it.
  `main.ts` and `user-profile-sheet.vue` already push `{ name: 'home' }` and are untouched.
- **A shared `auth-hero-layout.vue`** (`features/auth/presentation/components/`) owns
  the background `<picture>`, the dark gradient overlay, the `<h1>` hero title, the
  safe-area padding, and the translucent card wrapper — exposing a default slot for the
  page's own content. Both `home-page.vue` and `verify-otp-page.vue` render through it.
  This is extraction, not new capability: the CSS already exists twice.
- **Card is translucent over the overlay**, not opaque. Inputs keep a solid
  `--color-background` fill so text contrast never depends on what pixel of the
  mountain photo sits behind them.
- **Heading levels stay legal.** The hero `<h1>` is the only `h1` on either page; the
  in-card titles (`auth.emailEntry.title`, `auth.verifyOtp.title`) drop to `<h2>`,
  keeping their current visual size via the existing `.title` class.
- **i18n:** the whole `auth.home` block (`subtitle`, `getStartedBtn`) is deleted from
  `en.json` and `de-CH.json`. The card keeps `auth.emailEntry.*` verbatim — no new keys.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `auth`: the email-entry step is served at `/` instead of `/auth/email`, the
  intermediate call-to-action screen is gone, `/auth/email` no longer resolves, the OTP
  back button returns to `/`, and both auth screens share the hero background layout.

## Impact

- **Router (`src/app/router/index.ts`):** delete the `email-entry` route entry. The
  `home` route keeps `meta: { redirectIfAuth: true }`, so an authenticated visitor still
  bounces to `/map` — the guard behaviour is unchanged, it just guards one route fewer.
- **Deleted:** `src/features/auth/presentation/pages/email-entry-page.vue`.
- **Rewritten:** `home-page.vue` (form + hero layout), `verify-otp-page.vue` (hero
  layout + back target + `h1`→`h2`).
- **Added:** `src/features/auth/presentation/components/auth-hero-layout.vue`.
- **Locales:** `auth.home` block removed from `src/locales/en.json` and
  `src/locales/de-CH.json`. Both files must stay key-for-key identical.
- **Tests:** `test/features/auth/presentation/pages/verify-otp-page.test.ts` asserts
  `{ name: 'email-entry' }` on back — update to `{ name: 'home' }`. New
  `home-page.test.ts` covers the failure paths only (invalid email rejected without
  calling Supabase; `sendEmailOtp` rejection surfaces an error and stays put).
  `test/app/router/router-guards.test.ts` needs no change (it constructs routes by hand
  and never references `email-entry`).
- **PWA:** `pwa-support`'s "home page background extends into safe areas" requirement
  still holds — the hero layout carries the same edge-to-edge background and `--safe-top`
  / `--safe-bottom` padding. `/auth/verify-otp` now satisfies it too, where before it
  painted flat `--color-background`.
- **No new dependency, no DB change, no Worker change.** Background assets
  (`background-desktop.webp`, `background-mobile.webp`) are already bundled and now load
  on one more route.
