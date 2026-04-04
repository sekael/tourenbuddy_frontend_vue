## 1. External Dependencies & Theme Foundation

- [x] 1.1 Add Google Fonts (Inter 400/500/600) and Material Symbols Outlined CDN links to `index.html`
- [x] 1.2 Update `src/app/theme/tokens.css` — replace orange palette with blueish-grey (slate) tokens, add `--color-accent`, add `--shadow-sm/md/lg` layered shadow tokens
- [x] 1.3 Update `src/app/theme/typography.css` — set `--font-family-base` to Inter with system fallback, adjust heading weights to medium (500)
- [x] 1.4 Update `src/app/theme/global.css` — refine base styles for buttons, inputs, and body defaults with new tokens

## 2. Core Components

- [x] 2.1 Update `src/core/components/round-action-button.vue` — increase to 52px, use `--shadow-md`, support Material Symbols content in slot
- [x] 2.2 Update `src/core/components/error-snackbar.vue` — apply new error color tokens and shadow
- [x] 2.3 Update `src/core/components/pwa-install-banner.vue` — update colors, button styles, and shadow
- [x] 2.4 Update `src/core/components/crosshair.vue` — refine stroke color to match new palette

## 3. Auth Feature Components

- [x] 3.1 Update `src/features/auth/presentation/pages/home-page.vue` — new palette, Inter font, modern button styling
- [x] 3.2 Update `src/features/auth/presentation/pages/email-entry-page.vue` — replace text arrow with Material Symbols `arrow_back`, update input/button styles
- [x] 3.3 Update `src/features/auth/presentation/pages/verify-otp-page.vue` — replace text arrow with Material Symbols `arrow_back`, update input/button styles

## 4. Map Feature Components

- [x] 4.1 Update `src/core/components/round-action-button.vue` glassmorphism variant — add glass background option for map overlay usage
- [x] 4.2 Update `src/features/map/presentation/components/map-action-overlay.vue` — replace emoji with Material Symbols (`map`, `person`, `person_add`, `add_location_alt`), apply glass effect to FABs
- [x] 4.3 Update `src/features/map/presentation/components/base-map-picker.vue` — replace emoji with Material Symbols `map`, glassmorphism dropdown, updated shadow and border
- [x] 4.4 Update `src/features/map/presentation/components/location-picker.vue` — update cancel/continue button styles
- [x] 4.5 Update `src/features/map/presentation/pages/map-page.vue` — update sheet transition styles and backdrop

## 5. Tour Feature Components

- [x] 5.1 Update `src/features/tours/presentation/components/tour-creation-dialog.vue` — new dialog styling (shadow, border, radius), updated input/button styles
- [x] 5.2 Update `src/features/tours/presentation/components/tour-info-sheet.vue` — add drag handle, replace emoji with Material Symbols (`calendar_today`, `location_on`, `group`, `close`)

## 6. Contact Feature Components

- [x] 6.1 Update `src/features/contacts/presentation/components/contact-chip.vue` — pill shape (9999px radius), subtle primary tint when selected, Material Symbols `check`
- [x] 6.2 Update `src/features/contacts/presentation/components/contact-creation-dialog.vue` — new dialog styling, updated input/button styles

## 7. User Profile Feature

- [x] 7.1 Update `src/features/user/presentation/components/user-profile-sheet.vue` — add drag handle, Material Symbols `close` and `logout`, updated avatar and button styles

## 8. Verification

- [x] 8.1 Run `npm run lint` and fix any linting issues
- [x] 8.2 Run `npm run format` and verify formatting
- [x] 8.3 Run `npm run type-check` and fix any type errors
- [x] 8.4 Run `npm run test` and fix any failing tests
