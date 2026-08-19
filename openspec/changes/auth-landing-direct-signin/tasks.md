## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/260-auth-landing-direct-signin`

## 2. Shared hero layout component

- [x] 2.1 Create `src/features/auth/presentation/components/auth-hero-layout.vue` — background `<picture>` (`bgMobile` at `max-width: 768px`, `bgDesktop` otherwise, `alt=""` + `aria-hidden`), gradient overlay, hero `<h1>TourenBuddy</h1>`, and a default `<slot>` inside a translucent card. Moves the existing `.home-page` / `.background` / `.overlay` / `.title` CSS out of `home-page.vue` verbatim (design D2)
- [x] 2.2 Card styling: `max-width: 400px`, `display: flex; flex-direction: column; gap: var(--spacing-lg)`, `color-mix(in srgb, var(--color-surface) 88%, transparent)` + `backdrop-filter: blur(12px)` + `--radius-lg` + `--shadow-md`. 88% opacity means NO `@supports` fallback is needed — add a `ponytail:` comment saying so (design D3)
- [x] 2.3 Safe areas: no top padding on the outer element (background must reach the notch), inner content padding `calc(var(--spacing-xl) + var(--safe-top))` / `calc(var(--spacing-xl) + var(--safe-bottom))`, `min-height: 100lvh` with the `-webkit-fill-available` fallback line before it — same as today's `home-page.vue` (keeps the `pwa-support` edge-to-edge requirement satisfied)

## 3. Landing page becomes the sign-in page

- [x] 3.1 Rewrite `src/features/auth/presentation/pages/home-page.vue` to render `<AuthHeroLayout>` wrapping the email form. Move the form logic across from `email-entry-page.vue` unchanged: `emailRegex`, `email` / `error` / `isLoading` refs, `handleSubmit` calling `authStore.sendEmailOtp` then `router.push({ name: 'verify-otp', query: { email } })`, catch → `error`, `finally` → `isLoading = false`
- [x] 3.2 Card content: `auth.emailEntry.title` as `<h2 class="title">` (NOT `h1` — the hero owns it, design D4), `auth.emailEntry.subtitle`, the labelled email input (`type="email"`, `autocomplete="email"`, `required`), the error paragraph, the submit button. No back button (there is nowhere to go back to). Keep the input's opaque `--color-background` fill
- [x] 3.3 Delete `src/features/auth/presentation/pages/email-entry-page.vue`

## 4. Router + OTP page

- [x] 4.1 `src/app/router/index.ts` — delete the `email-entry` route entry. Leave the `home` route (`redirectIfAuth: true`) and every other route untouched; verify no `name: 'email-entry'` reference survives (`grep -rn "email-entry" src/`)
- [x] 4.2 `verify-otp-page.vue` — wrap in `<AuthHeroLayout>`, drop its now-duplicated `.page` / `.card` CSS, retarget the back button to `router.push({ name: 'home' })`, demote `<h1 class="title">` to `<h2 class="title">` (design D4). Verify/resend logic untouched

## 5. i18n

- [x] 5.1 Delete the whole `auth.home` block (`subtitle`, `getStartedBtn`) from `src/locales/en.json` AND `src/locales/de-CH.json` — both files must stay key-for-key identical (design D5). Add no new keys
- [x] 5.2 `grep -rn "auth.home" src/` — must return nothing

## 6. Tests (edge cases + failures only)

- [x] 6.1 New `test/features/auth/presentation/pages/home-page.test.ts` with `createTestingPinia()`: (a) invalid email on submit ⇒ validation error rendered AND `authStore.sendEmailOtp` NOT called; (b) `sendEmailOtp` rejects ⇒ error message rendered, `router.push` NOT called. Do NOT assert the happy path
- [x] 6.2 `test/features/auth/presentation/pages/verify-otp-page.test.ts` — update the back-button assertion from `{ name: 'email-entry' }` to `{ name: 'home' }`. Rest of the file unchanged
- [x] 6.3 `test/app/router/router-guards.test.ts` — confirm no change needed (it builds routes by hand, never references `email-entry`)
- [x] 6.4 `npm run test` — all pass

## 7. Manual verification

- [ ] 7.1 `npm run dev`, signed out: `/` shows the hero background with the email form on it — no "Get Started" step. Submit → `/auth/verify-otp` keeps the same background; back button returns to `/`
- [ ] 7.2 Check card + input contrast at both breakpoints (≤768px uses the mobile asset, which crops differently) and confirm no `h1` duplication (`document.querySelectorAll('h1').length === 1` on both pages)
- [ ] 7.3 Signed out from the profile sheet ⇒ lands on `/` and sees the form (the sign-out path pushes `{ name: 'home' }`)

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` — zero warnings
- [x] 8.2 `npm run type-check` — clean
- [x] 8.3 Prompt user to commit (do NOT commit) with message: `feat(auth): sign-in form on landing page (#260)`
- [x] 8.4 Prompt user to push the branch and open a PR to `main`
