## Context

Sign-in is two screens: `/` (`home-page.vue`, email field) → `/auth/verify-otp`
(`verify-otp-page.vue`, 6-digit field). The code is delivered by email only — there is no
SMS channel anywhere in the product. Delivery path:

```
signInWithOtp (auth-store.ts:32)
  → Supabase send-email hook
    → services/email-hook/src/index.ts:79  (posts { otp, email } to Brevo)
      → Brevo hosted template (EN: BREVO_TEMPLATE_EN, DE: BREVO_TEMPLATE_DE)
```

The Brevo templates are the rendered email body. **They are not in this repository** —
only their numeric IDs are, as Worker env vars. Any change to the mail's wording is a
dashboard edit, not a commit.

Current state of the two inputs:

| | file:line | attributes |
|---|---|---|
| email | `home-page.vue:55-63` | `type="email"`, `autocomplete="email"`, `required`, `id="email"` — **no `name`** |
| code | `verify-otp-page.vue:84-94` | `type="text"`, `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"`, `required` |

Both already carry the attribute the platform documentation asks for. The issue is
therefore not "are we missing an attribute" but "what does that attribute actually buy,
and what else is left".

### What the platforms actually do

| Platform | Emailed-code autofill | Mechanism |
|---|---|---|
| iOS 16+ / iPadOS 16+ Safari, macOS 13+ Safari, **with Apple Mail** | **Yes** | OS scans incoming Mail for a code, offers it above the keyboard on a field marked `autocomplete="one-time-code"` |
| Android / Chrome | **No** | WebOTP is the only API; `transport` accepts `'sms'` only |
| Desktop Chrome / Edge / Firefox | **No** | No API exists |
| Any platform, mail read in Gmail / Proton Mail / Outlook app | **No** | Only Apple Mail feeds the iOS heuristic |

Two consequences shape the whole change: there is nothing to build for Android or
desktop, and the iOS path's remaining variable is the **email body**, not the markup.

## Goals / Non-Goals

**Goals**
- Record the platform matrix and its reasoning durably, so the question is not
  re-investigated from scratch.
- Give the one iOS path the best chance of firing, by auditing the Brevo template wording
  and confirming on a real device.
- Remove the friction that *is* fixable everywhere: whitespace-dirty pasted codes, and
  the redundant tap after the field is filled.
- Keep the email field maximally legible to password-manager field classifiers.

**Non-Goals**
- No magic link (D5). No second delivery channel, no callback route.
- No SMS delivery — that would make WebOTP available, and is a different product
  decision with cost and phone-number implications far beyond this issue.
- No change to `shouldCreateUser` or to signup-vs-login semantics (D6).
- No custom OTP UI (six separate boxes). The single field is what iOS autofill and
  clipboard suggestion both target most reliably.
- No attempt to detect or special-case alias providers.

## Decisions

### D1 — The findings doc is the primary deliverable

`docs/otp-and-email-autofill.md` carries the matrix above, the WebOTP transport
limitation with its consequence spelled out, Apple's body heuristic, the password-manager
notes, and the rejected options with reasons.

- *Why a doc and not just the issue thread?* The valuable output is a negative result:
  "Android and desktop cannot do this, stop looking." An issue comment is not where
  someone checks before opening the same investigation in six months; `docs/` is, and
  `docs/` already holds this kind of cross-cutting note (`notifications.md`,
  `realtime-and-pwa-energy.md`).
- *Why it must state the WebOTP transport explicitly:* the API's name suggests generality
  and most write-ups about it silently assume SMS. Without the sentence "email is not a
  transport", the next reader concludes it was simply never wired up.

### D2 — `name="email"`, keeping `autocomplete="email"`

- *Why, if `autocomplete` is the documented signal?* It is the strongest signal, and on
  its own it is usually enough. Field classifiers in Proton Pass, 1Password, and Bitwarden
  score several attributes together and `name` is one of them; a missing `name` is a
  weaker form than a present one, for one attribute of cost.
- *Why not also add `name` to the OTP field?* A one-time code is not a credential a
  manager should ever store, and naming it invites exactly that. `autocomplete="one-time-code"`
  is the correct and sufficient marker there.
- **Nothing in the markup can request alias creation.** Alias offers (Proton Pass
  hide-my-email, iCloud Hide My Email) fire when a manager classifies the form as a
  *signup*. This form is signup and login simultaneously — one email field, one button,
  same endpoint for both — and there is no attribute that declares intent. Documented in
  the findings doc as a genuine limitation, not worked around.

### D3 — Normalize to digits on input, not only on paste

`code` is filtered to `[0-9]` and truncated to six on every update, not in a `@paste`
handler.

- *Why not `@paste`?* iOS autofill, the Android clipboard suggestion chip, and drag-drop
  all populate the field without ever firing a paste event. A paste-only handler fixes the
  narrowest of the three sources. One normalization point covers all of them, including
  ordinary typing.
- *Why strip rather than reject?* `123 456` and `123456\n` are the same code with mail-client
  formatting attached. Rejecting them shows the user an error about something they did
  correctly.
- *Why keep `maxlength="6"` as well?* It remains the cheap native guard for typing;
  normalization is what handles programmatic fills, which `maxlength` does not constrain.

### D4 — Auto-submit on six digits, guarded against repeat submission

When the normalized value reaches six digits, verification fires without a second tap.

- *Why auto-submit at all?* It is the whole payoff. iOS autofill fills the field and stops;
  the user still hunts for the button. Without this, the change saves a copy-paste and
  adds a tap.
- *Why length six is a safe trigger:* the code is fixed-length. There is no valid longer
  input to wait for.
- **The guard is the real design content.** `handleVerify` clears `code` on failure
  (`verify-otp-page.vue:42`), so a naive `watch` produces: fill → submit → fail → clear →
  user retypes → submit. That much is fine. What is not fine is a resend arriving, or a
  re-render, re-triggering a submit of a value already known to be rejected, and an
  in-flight verification being raced by a second one. The rule: submit only when the value
  is six digits, no verification is in flight, and this exact value has not already been
  attempted. The last-attempted value resets when the user edits the field.
- *Why not debounce instead?* A timer makes correctness depend on typing speed and turns a
  deterministic condition into a flaky test. The condition is knowable exactly.
- *Why keep the visible submit button?* It is the fallback when the guard suppresses a
  submit (a genuine retry of the same code after a resend), and removing it would leave a
  form with no submit affordance for keyboard and screen-reader users.

### D5 — Magic link stays rejected

- The project already shipped magic links and removed them:
  `openspec/specs/auth/spec.md:178` records that the link always opens in the system
  browser rather than the installed PWA window, stranding the user outside the app. That
  failure is structural, not a wording problem, and reintroducing the link reintroduces it.
- The secondary objections stand independently: corporate and scanner-equipped mail
  providers fetch links on delivery and burn a single-use token before the user clicks;
  and a link breaks the cross-device case (read mail on phone, sign in on laptop) that the
  code handles natively.

### D6 — The alias / `shouldCreateUser` hazard is documented, not fixed

`signInWithOtp` (`auth-store.ts:32`) passes no `shouldCreateUser`, so it defaults to
`true` and every unseen address provisions an account. A user who generates a fresh alias
per sign-in therefore lands in a new empty account with no error — their data appears
gone.

- *Why not fix it here?* Fixing it means deciding signup-vs-login semantics — a distinct
  "create account" path, or a `shouldCreateUser: false` login path with a
  user-not-found branch. That is auth-flow work with its own edge cases and its own
  proposal, and it is not what #261 asks.
- *Why document it prominently anyway?* It is the one place where alias support and the
  current auth flow genuinely collide, the failure is silent, and it looks to the user
  like data loss. The judgement that it is rare — managers default to one alias per site,
  not per login — is the issue author's, and it is recorded as such.

### D7 — Test the guard, not the autofill

New `verify-otp-page.test.ts` cases cover only failure and edge paths, per
`.claude/testing.md`: a code pasted with whitespace normalizes to six digits and submits
once; a rejected code is not auto-resubmitted after the field is cleared; fewer than six
digits never submits.

- *Why no test asserting autofill works?* Nothing in happy-dom models an OS credential
  provider. Such a test would assert the mock, not the behaviour.
- *Why the manual iOS check is mandatory:* it is the only evidence that the change met the
  issue's actual goal. Its result — including a negative one — belongs in the findings doc.

## Risks / Trade-offs

- **The Brevo audit may change nothing observable.** Apple's heuristic is undocumented and
  adjusted between OS releases; a template can look correct and still not trigger. Mitigated
  by treating the device test as the source of truth and recording the outcome either way,
  so the next person inherits a measurement rather than a theory.
- **Auto-submit fires on a mistyped sixth digit**, spending one of a limited number of
  attempts. Accepted: the code was already wrong; the user retypes either way. The guard
  ensures the wrong value is attempted once, not repeatedly.
- **Editing the Brevo template is an out-of-repo mutation** with no review trail and no
  rollback. Mitigated by recording the before/after wording in the findings doc.
- **`name="email"` alters what managers save.** They may now store an entry keyed on the
  field name. This is the intended effect, and the field holds an email address, not a
  secret.
- **Alias hazard remains live** (D6). Accepted by the issue author; if it is reported in
  the wild, the findings doc is the pointer to the cause.

## Migration Plan

Single PR. Client-only: no migration, no Worker deploy, no env var, no feature flag. The
Brevo template edit is independent of the deploy and can land before or after it — the
Worker contract (`{ otp, email }`) does not change, so an old template and a new frontend,
or the reverse, both work.

## Open Questions

None. Scope, the magic-link rejection (D5), and the decision to document rather than fix
the alias hazard (D6) were resolved with the issue author before this proposal.
