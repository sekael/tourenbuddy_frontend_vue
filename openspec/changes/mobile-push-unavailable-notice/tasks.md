## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/151-mobile-push-notice`

## 2. i18n

- [x] 2.1 Add `notifications.pushUnavailable` = "Not available" to `src/locales/en.json`
- [x] 2.2 Add `notifications.pushUnavailable` = "Nicht verfügbar" to `src/locales/de-CH.json`
- [x] 2.3 Verify no duplicate / missing keys across locales

## 3. Component changes

- [x] 3.1 In `src/features/notifications/presentation/components/notification-preferences-section.vue`, import `BaseTooltip` from `@/core/components/base-tooltip.vue`
- [x] 3.2 Replace the `v-if="requiresPwaInstall"` `span.row-hint` block with a compact unavailable group: "Not available" label + `<BaseTooltip>` wrapping a Material Symbols `info` icon `<button>`; tooltip `text` = `t('notifications.installHint')`; button `aria-label` = same hint string
- [x] 3.3 Replace the `v-else-if="pushDenied"` `span.row-hint.row-hint--warning` block with the same compact group using `t('notifications.deniedHint')` as tooltip text and warning color applied to the info icon
- [x] 3.4 Add scoped styles for the new compact group (`.unavailable`, `.unavailable__label`, `.unavailable__info`, `.unavailable__info--warning`) using existing spacing/color tokens; ensure single-line layout (no wrap) on narrow viewports
- [x] 3.5 Remove now-unused `.row-hint` and `.row-hint--warning` styles
- [x] 3.6 Confirm component stays under ~150 lines per convention; extract a sub-component only if exceeded

## 4. Tests

- [x] 4.1 In `test/features/notifications/presentation/components/notification-preferences-section.spec.ts` (create if missing), add a case for `requiresPwaInstall=true`: badge + info button rendered, `aria-label` matches `installHint`, toggle absent
- [x] 4.2 Add a case for `pushDenied=true`: badge + warning-colored info button rendered, `aria-label` matches `deniedHint`
- [x] 4.3 Add a negative case: when push is supported and not denied/not requiring install, the toggle is rendered and no unavailable badge appears
- [x] 4.4 Mock `useNotificationCapability` and `useNotificationsStore` per existing test patterns; do not mock concrete repositories

## 5. Verify

- [x] 5.1 Run `npx eslint . --fix` — zero warnings
- [x] 5.2 Run `npm run type-check`
- [x] 5.3 Run `npm run test`
- [ ] 5.4 Manually verify in dev (`npm run dev`) on a mobile viewport in both `en` and `de-CH` that the push row stays single-line in both unavailable states and the tooltip reveals the full hint on tap

## 6. Finalize

- [x] 6.1 Stage relevant files; do NOT run `git commit`
- [x] 6.2 Provide the user a ready-to-copy conventional commit message:
  `feat(notifications): compact mobile push unavailable notice (#151)`
- [x] 6.3 Prompt the user to push the branch and open a PR against `main` referencing issue #151
- [x] 6.4 Prompt the user to run `/opsx:archive` once merged
