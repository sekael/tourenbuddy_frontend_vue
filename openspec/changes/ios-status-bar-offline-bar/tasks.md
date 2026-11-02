## 1. iOS status bar

- [x] 1.1 Drop `apple-mobile-web-app-status-bar-style` from `index.html`, with the reason
- [ ] 1.2 Owner: re-add the app to the Home Screen and check the top edge and the form's Save button

## 2. Offline bar

- [x] 2.1 `--safe-top` includes `--offline-bar-height` (registered, transitions); `:has()` opens it
- [x] 2.2 `offline-indicator.vue`: the bar replaces the corner chip and the offline snackbar
- [x] 2.3 `offline-sync-status.vue`: drop the pending chip (its count is in the bar)
- [x] 2.4 Side drawer and collapsed dialog start below the bar
- [x] 2.5 Locales (en, de-CH); unit test for the bar's states
- [x] 2.6 "N changes synced" toast after a clean drain online (review round 1)

## 3. Review

- [x] 3.1 Lint, type-check, tests
- [x] 3.2 Persona review at 402×874 / 360×740 de-CH and desktop until PASS
