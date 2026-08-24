## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/261-otp-email-autofill` — branch created; note `git fetch` was unavailable in the proposal environment, so rebase on `origin/main` before opening the PR

## 2. Findings doc

- [x] 2.1 Create `docs/otp-and-email-autofill.md` with the per-platform support matrix from design "What the platforms actually do" (iOS 16+/macOS Safari + Apple Mail = yes; Android/Chrome = no; desktop = no; non-Apple mail clients = no)
- [x] 2.2 State the WebOTP limitation explicitly and with its consequence: `navigator.credentials.get({ otp: { transport: ['sms'] } })` accepts `'sms'` as its only transport, therefore emailed-code autofill on Android/desktop is **not implementable**, not merely unimplemented (design D1). Someone reading this in six months must not conclude it was skipped
- [x] 2.3 Document what Apple's Mail heuristic needs from the email body (a 6-digit token adjacent to wording like "code" / "verification code", minimal competing numbers) and that the body lives in the **Brevo hosted templates**, not this repo — `services/email-hook/src/index.ts:79` only passes `{ otp, email }` through
- [x] 2.4 Document the password-manager / alias findings: `autocomplete="email"` + `name` is the whole markup contract (D2); alias-creation offers depend on a manager classifying the form as *signup*, and this form is signup-and-login at once, so **no attribute can request it** — a real limitation, not a gap to close
- [x] 2.5 Document the rejected options with reasons: magic link (D5 — cite `openspec/specs/auth/spec.md:178`, it opens in the system browser instead of the installed PWA; plus link-scanner token burn and cross-device breakage) and SMS delivery (would enable WebOTP, but is a separate product decision)
- [x] 2.6 Document the `shouldCreateUser` sharp edge (D6): `auth-store.ts:32` omits the option, so it defaults `true`; a fresh alias per sign-in silently provisions a new empty account that looks to the user like data loss. Record that it is knowingly **not fixed** in this change and why
- [x] 2.7 Leave the device-test result section empty for now — task 6.1 fills it in

## 3. Email field

- [x] 3.1 `src/features/auth/presentation/pages/home-page.vue:55-63` — add `name="email"` to the email input. Keep `autocomplete="email"`, `type="email"`, `required`, and `id="email"` exactly as they are (design D2)

## 4. OTP input normalization + auto-submit

- [x] 4.1 `src/features/auth/presentation/pages/verify-otp-page.vue` — normalize `code` to digits only, truncated to six, on **every** value change (not in a `@paste` handler: autofill and clipboard suggestions never fire paste — design D3). Keep `maxlength="6"` on the input as the native typing guard
- [x] 4.2 Auto-submit once the normalized value is six digits, guarded so that (a) nothing submits while `isVerifying` is true, and (b) a value already attempted is not resubmitted until the user edits the field. Remember `handleVerify` clears `code` on failure at line 42 — the guard must survive that clear-then-refill cycle (design D4).
- [x] 4.3 Keep the visible submit button and its `code.length < 6` disabled condition — it is the fallback for a deliberate retry of a previously rejected code, and the only submit affordance for keyboard/screen-reader users (design D4)
- [x] 4.4 Do NOT add a `name` attribute to the OTP input — a one-time code must not be offered to password managers as a storable credential (design D2)

## 5. Tests (edge cases + failures only)

- [x] 5.1 `test/features/auth/presentation/pages/verify-otp-page.test.ts` — add: a value set to `'123 456\n'` normalizes to `'123456'` and calls `verifyOtp` exactly **once**
- [x] 5.2 Add: `verifyOtp` rejects ⇒ the error renders, the field clears, and no second `verifyOtp` call is issued for the same value
- [x] 5.3 Add: fewer than six digits ⇒ `verifyOtp` is never called and the submit button stays disabled
- [x] 5.4 Do NOT write a test asserting that OS autofill works — happy-dom models no credential provider, so such a test asserts the mock (design D7)
- [x] 5.5 `npm run test` — all pass

## 6. Brevo template audit (only the paste step is manual/out of repo — the only remaining task that affects real autofill)

- [x] 6.1a Reword `services/email-hook/templates/otp_{en,de}.{txt,html}` to fit the heuristic in 2.3: code inline beside the word "code"/"Code", `60 minutes`/`60 Minuten` reworded to `one hour`/`eine Stunde` to remove a competing number. Recorded in `docs/otp-and-email-autofill.md`
- [x] 6.1b Paste the updated `otp_en.txt` / `otp_en.html` / `otp_de.txt` / `otp_de.html` into the live Brevo EN (`BREVO_TEMPLATE_EN`) and DE (`BREVO_TEMPLATE_DE`) templates — this repo has no Brevo deploy hook, so 6.1a alone changes nothing in production (design "Risks")
- [ ] 6.2 Trigger a real sign-in on a physical **iOS 16+ device** with the account's mail in **Apple Mail**, and observe whether the code is offered above the keyboard. Record the result in the findings doc **either way** — a negative result is the valuable output, and it is the acceptance evidence for issue #261
- [ ] 6.3 Confirm no `wrangler deploy` is needed: `services/email-hook/` has no code change, and the Worker→Brevo contract (`{ otp, email }`) is unchanged

## 7. Manual verification

- [ ] 7.1 `npm run dev`: paste `123 456` into the OTP field ⇒ it becomes `123456` and verification starts with no extra tap
- [ ] 7.2 Enter a wrong 6-digit code ⇒ error shows, field clears, and no submit loop occurs (watch the network tab: exactly one `verify` request)
- [ ] 7.3 Focus the email field on `/` with a password manager active ⇒ it is offered as an email field; a filled value submits identically to a typed one

## 8. Finalize

- [x] 8.1 `npx eslint . --fix` — zero warnings
- [x] 8.2 `npm run type-check` — clean
- [ ] 8.3 Prompt user to commit (do NOT commit) with message: `feat(auth): normalize and auto-submit OTP code, document email autofill limits (#261)`
- [ ] 8.4 Prompt user to push the branch and open a PR to `main`
- [ ] 8.5 Prompt user to archive this change with the `openspec-archive` skill
