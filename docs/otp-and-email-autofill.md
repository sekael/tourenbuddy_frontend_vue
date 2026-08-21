# OTP and email autofill

Investigation for [#261](https://github.com/sekael/tourenbuddy/issues/261): can the
emailed verification code auto-fill instead of forcing an app-switch and copy-paste, and
does email autofill / alias creation need special configuration?

**Short answer:** the markup is already correct and cannot be improved further. Autofill
of an _emailed_ code exists on exactly one platform combination (Apple), and whether it
fires there depends on the wording of the email body — which lives in Brevo, not in this
repo. On Android and desktop it is **not implementable at all**.

## Platform support matrix

| Platform                                                                      | Emailed-code autofill | Mechanism                                                                                                               |
| ----------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| iOS 16+ / iPadOS 16+ Safari, macOS 13+ Safari, **reading mail in Apple Mail** | **Yes**               | The OS scans incoming Mail for a code and offers it above the keyboard on a field marked `autocomplete="one-time-code"` |
| Android / Chrome                                                              | **No**                | WebOTP is the only API, and it does not accept email                                                                    |
| Desktop Chrome / Edge / Firefox                                               | **No**                | No API exists                                                                                                           |
| Any platform, mail read in Gmail / Proton Mail / Outlook                      | **No**                | Only Apple Mail feeds the iOS heuristic                                                                                 |

Both inputs already carry the attribute the platform documentation asks for:

| Field | Location                                                   | Attributes                                                                            |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Email | `src/features/auth/presentation/pages/home-page.vue`       | `type="email"`, `autocomplete="email"`, `name="email"`, `required`                    |
| Code  | `src/features/auth/presentation/pages/verify-otp-page.vue` | `type="text"`, `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"` |

## Why Android and desktop cannot do this

The WebOTP API is the only browser mechanism for programmatic one-time-code retrieval:

```js
navigator.credentials.get({ otp: { transport: ['sms'] } })
```

`transport` accepts **`'sms'` and nothing else**. There is no `'email'` transport. This is
a limitation of the API surface, not something this app has failed to wire up — no amount
of frontend work makes emailed-code autofill possible on Android or on any desktop
browser.

> If you are re-reading this because it looks like an obvious gap: it is not a gap. Do not
> re-open this investigation without first checking whether the WebOTP spec has gained an
> email transport. As of this writing it has not.

The only route to WebOTP would be delivering the code by **SMS**, which is a separate
product decision with cost and phone-number-collection implications far beyond #261.

## What Apple's Mail heuristic needs

Apple's detector is undocumented and adjusted between OS releases, but it keys off the
email body, not the markup. It wants:

- a 6-digit token,
- adjacent to wording like _code_, _verification code_, _security code_, or _one-time
  code_, in the subject or near the token in the body,
- with as few competing numbers nearby as possible (dates, prices, order numbers, phone
  numbers, and long unsubscribe URLs all reduce confidence).

**The body is not in this repository.** The delivery path is:

```
signInWithOtp (src/features/auth/presentation/stores/auth-store.ts)
  → Supabase send-email hook
    → services/email-hook/src/index.ts   (posts { otp, email } to Brevo)
      → Brevo hosted template (env: BREVO_TEMPLATE_EN / BREVO_TEMPLATE_DE)
```

The Worker only passes the token through. Changing the mail's wording is a **Brevo
dashboard edit** — no commit, no review trail, no rollback. Record any such edit in the
"Device test results" section below.

## Password managers and email aliases

`autocomplete="email"` plus a `name` attribute is the entire markup contract. Field
classifiers in Proton Pass, 1Password, and Bitwarden score several attributes together;
`autocomplete` is the strongest signal and `name` reinforces it. Both are present.

The OTP field deliberately has **no `name` attribute** — a one-time code is not a
credential a password manager should offer to store.

### Alias creation cannot be requested from markup

Alias offers (Proton Pass hide-my-email, iCloud Hide My Email) fire when a manager
classifies a form as a **signup**. Our sign-in form is signup and login _simultaneously_:
one email field, one button, one endpoint, and Supabase provisions an account for an
unseen address. There is no attribute that declares that intent, and
`autocomplete="new-password"`-style signup hints have no email equivalent.

This is a genuine limitation, not something left undone. Aliases work fine when the user
creates one themselves; we simply cannot prompt for it.

## Known sharp edge: a fresh alias per sign-in creates a new empty account

`signInWithOtp` in `src/features/auth/presentation/stores/auth-store.ts` passes no
`shouldCreateUser` option, so it defaults to `true`. Every previously unseen address
provisions a new account.

A user who mints a **fresh alias on each sign-in** therefore lands in a brand-new, empty
account — no error, no warning. To them it looks like their tours were deleted.

This is **knowingly not fixed** here. Fixing it means deciding signup-vs-login semantics
(a distinct "create account" path, or `shouldCreateUser: false` on login with a
user-not-found branch), which is auth-flow work with its own edge cases and deserves its
own change. The risk was judged low because password managers default to one alias _per
site_, not per login. If this is ever reported in the wild, this section is the cause.

## Rejected options

### Magic link

Rejected. The project already shipped magic links and removed them — see
`openspec/specs/auth/spec.md` ("Magic links break the installed-PWA experience"): the link
always opens in the system browser rather than the standalone PWA window, stranding the
user outside the app mid-sign-in. That failure is structural and would return with the
link.

Two independent objections also stand:

- Corporate and scanner-equipped mail providers fetch links on delivery, burning a
  single-use token before the user clicks.
- A link breaks the cross-device case (read mail on the phone, sign in on the laptop),
  which a typed code handles natively.

### SMS delivery

Rejected for this change. It would make WebOTP available on Android, but it is a product
decision about cost and collecting phone numbers, not an autofill fix.

### One box per digit

Rejected. A single field is what iOS autofill and the OS clipboard suggestion both target
most reliably; split fields regularly defeat both.

## What was changed instead

Friction that _is_ fixable on every platform:

- The OTP field normalizes its value to digits and truncates to six on **every** change —
  not just on paste, because autofill and clipboard suggestions never fire a paste event.
  A code arriving as `123 456` or with a trailing newline is accepted.
- Verification submits automatically once six digits are present, so autofill and paste
  do not still require hunting for a button.

## Device test results

Apple's heuristic can only be verified on hardware. Record every attempt here — **a
negative result is the valuable output**, because it stops the next person theorising.

| Date      | iOS version | Locale / template | Template wording (subject) | Code offered? |
| --------- | ----------- | ----------------- | -------------------------- | ------------- |
| _pending_ |             |                   |                            |               |

<!-- Fill this in as part of the Brevo template audit. If wording was changed, record the
     before and after text — the Brevo edit has no git history. -->
