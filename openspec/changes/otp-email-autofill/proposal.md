## Why

Issue #261 asks whether the app can be configured so the emailed verification code
auto-fills instead of forcing an app-switch and copy-paste, and whether anything is
needed to support email autofill and alias creation (Proton, iCloud) at sign-in.

The investigation's headline finding is that **the client-side attribute work is already
done** — `verify-otp-page.vue:89` carries `autocomplete="one-time-code"` and
`home-page.vue:61` carries `autocomplete="email"` — and that **no web API exists** to
autofill an emailed code on Android or desktop. The WebOTP API
(`navigator.credentials.get({ otp: { transport: ['sms'] } })`) accepts SMS as its only
transport. The single platform path that works is iOS 16+ / macOS Safari reading Apple
Mail, and whether it fires depends on the **wording of the email body** — which lives in
a Brevo hosted template, outside this repo, not on any code in `src/`.

So the change that actually moves the needle is not a code change at all, and the
remaining friction (paste a code that arrives with stray whitespace, then tap a second
button) is fixable cheaply for every platform. This change captures the investigation so
it is not re-run, lands the cheap wins, and drives the one lever that affects real
autofill.

## What Changes

- **Findings doc** at `docs/otp-and-email-autofill.md`: the per-platform support matrix,
  why WebOTP does not apply, what Apple's Mail heuristic requires of the email body, what
  password managers key off for email autofill and alias creation, and the rejected
  options with their reasons.
- **Email input gains `name="email"`** (`home-page.vue`) — reinforces the signal that
  Proton Pass / 1Password / Bitwarden field classifiers read, alongside the existing
  `autocomplete="email"`.
- **OTP input hardening** (`verify-otp-page.vue`): non-digit characters are stripped from
  typed and pasted input, so a code pasted as `123 456` or with a trailing newline from a
  mail client is accepted instead of silently failing `maxlength`/validation.
- **OTP auto-submit**: once six digits are present, verification fires without a second
  tap — the payoff for autofill and for paste alike. Guarded so a rejected code is not
  resubmitted unchanged and no submit overlaps an in-flight one.
- **Brevo OTP template audit (manual, out of repo)**: check the EN and DE templates'
  subject and body against Apple's code-detection heuristic, adjust wording, and verify
  on a real iOS device. This is the only task in the change that affects whether autofill
  actually happens.
- **Documented, not fixed**: `signInWithOtp` runs with the default `shouldCreateUser:
  true` (`auth-store.ts:32`), so a user who mints a *fresh* email alias per sign-in
  silently lands in a new, empty account. Recorded in the findings doc as a known sharp
  edge; no behaviour change here.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auth`: the OTP input's accepted-input and submission behaviour becomes explicit
  (digit-only normalization, auto-submit on completion, no duplicate submits), and the
  email field's autofill contract is stated.

## Impact

- **Code**: two files under `src/features/auth/presentation/pages/`, plus one new test
  file. No store, router, repository, or schema change.
- **Backend / DB**: none. No migration.
- **Worker**: no code change to `services/email-hook`, therefore **no `wrangler deploy`**.
  The Brevo templates are edited in the Brevo dashboard; `index.ts:79` already passes
  `otp` and `email` as params and needs no new field.
- **Env / CI**: none.
- **Explicitly out of scope**: magic-link sign-in (rejected — see design D5; the project
  already removed it once, recorded at `openspec/specs/auth/spec.md:178`), and any change
  to account-creation semantics for new aliases.
- **Verification**: the autofill outcome cannot be asserted in Vitest or CI — it requires
  a physical iOS device with Apple Mail. That manual step is in the task list and is the
  acceptance evidence for the issue.
