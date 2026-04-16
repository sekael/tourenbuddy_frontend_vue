## Context

`usePhoneActions` currently builds `whatsAppLink` by stripping every non-digit from the raw phone string and appending the result to `https://wa.me/`. Phone numbers in TourenBuddy are user-entered free text — some contacts carry `+41 ...`, vCard imports usually include the country code, but many manual entries and device-picker imports are local Swiss format (`079 ...`). For local-format numbers wa.me receives `0791234567` and WhatsApp shows "The phone number shared via url is invalid" (issue #32).

Per WhatsApp docs the `wa.me/<number>` path requires digits only in full international form without leading zeros, brackets or dashes. There is no way to reliably infer a country code from a bare local number without a parser like `libphonenumber-js` and an assumed default region — both explicitly out of scope for this fix.

## Goals / Non-Goals

**Goals:**

- Produce a valid `wa.me` URL whenever the input unambiguously carries a country code (leading `+` or `00`).
- Return `null` whenever country code is absent, so the chip can hide the WhatsApp icon instead of handing WhatsApp a broken URL.
- Keep `tel:` behavior unchanged — local dialing must keep working on any input.
- No new dependency, no DB change, no user migration.

**Non-Goals:**

- Automatic country-code inference from user locale or tour region.
- Full E.164 validation, length checks, or carrier-prefix rules (leave parsing robustness to a later change).
- Rewriting or backfilling stored phone values.
- UI changes beyond what already falls out of `whatsAppLink` becoming `null` (the `v-if` in `contact-chip.vue` already handles this).

## Decisions

### Only emit `wa.me` when the input is international form

When the trimmed input starts with `+` or `00`, treat it as E.164. Strip the prefix, strip remaining non-digits, and build `https://wa.me/<digits>`. Otherwise return `null`.

Rationale: wa.me's failure mode for a bad number is an opaque error screen, not a graceful fallback. Hiding the button is strictly better UX than a guaranteed dead-end. `+` and `00` are the two unambiguous international markers worldwide; anything else is ambiguous and unsafe to guess.

Alternatives considered:

- **Default to Switzerland (`+41`) when no country code present.** Rejected: TourenBuddy is Swiss-centric today but not Swiss-only, and silently fabricating a country code for a user's contact is a data-integrity risk. A wrong guess dials a stranger.
- **Add `libphonenumber-js`.** Rejected for this fix: ~20KB min bundle for what is a one-line URL builder, and still needs a default region to parse bare local numbers. If broader phone-parsing needs emerge (validation, formatting, region inference), propose it as its own change.
- **Use `https://api.whatsapp.com/send?phone=...`.** Rejected: same input requirement as `wa.me`, no behavior difference; `wa.me` is the documented canonical form.

### Keep `telLink` unchanged

`tel:` URIs accept local dialable formats — the phone app handles them. Gating `telLink` the same way as `whatsAppLink` would regress the working call button.

### No input-format migration

Existing contacts stay as-is. The fix is purely client-side URL generation. If a user notices the WhatsApp icon is missing, they can edit the contact to add the country code (form placeholder already shows `+41 79 123 45 67`).

## Risks / Trade-offs

- **Users with local-format contacts lose the WhatsApp button** → Mitigation: the button currently leads to a broken experience anyway; hiding it is a net improvement. Form placeholder already documents the expected international format. A follow-up could add inline help text on the contact form explaining that WhatsApp requires `+<country>`.
- **`00`-prefixed numbers are country-specific (international exit code varies)** → Mitigation: Europe/CH uses `00`; North America uses `011`. Supporting `00` covers the vast majority of our user base; a stray `00`-in-another-context number is essentially non-existent in the Swiss contact space. If we see real misroutes we can tighten to `+`-only.
- **No validation of digit length** → Mitigation: out of scope. wa.me tolerates slightly malformed numbers gracefully compared to the all-digits-with-leading-zero case that motivated this bug.
