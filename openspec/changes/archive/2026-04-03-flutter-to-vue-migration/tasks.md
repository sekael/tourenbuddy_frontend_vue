## 1. Project Scaffolding

- [x] 1.1 Create `package.json` with all dependencies and devDependencies from CLAUDE.md, plus scripts (dev, build, lint, format, test, type-check)
- [x] 1.2 Create `vite.config.ts` with `@vitejs/plugin-vue`, `unplugin-vue-router`, and `vite-plugin-pwa` plugins
- [x] 1.3 Create `tsconfig.json` and `tsconfig.app.json` with strict TypeScript settings for Vue
- [x] 1.4 Create ESLint config using `@antfu/eslint-config` and Prettier config
- [x] 1.5 Create `index.html` entry point and `src/main.ts` that creates the Vue app with Pinia and Vue Router
- [x] 1.6 Create `src/App.vue` with `<RouterView>` as the root component
- [x] 1.7 Create `.env.example` with placeholder values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [x] 1.8 Run `npm install` and verify `npm run dev` starts without errors

## 2. Core Infrastructure

- [x] 2.1 Create `src/core/constants/env.ts` with Zod schema validating `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [x] 2.2 Create `src/core/utils/supabase.ts` initializing the Supabase client singleton with validated env vars
- [x] 2.3 Create `src/core/logging/use-logger.ts` composable wrapping `consola`
- [x] 2.4 Create `src/core/exceptions/` with `UnauthenticatedUserException`, `UnauthorizedUserException`, and `NoUserProfileException` classes
- [x] 2.5 Create `src/app/theme/tokens.css` with CSS custom properties for spacing (xxs–xxl), radius (sm/md/lg), and orange color palette
- [x] 2.6 Create `src/app/theme/typography.css` with font-related CSS custom properties
- [x] 2.7 Create `src/app/theme/global.css` importing tokens and typography, setting base styles

## 3. Routing & Auth Gate

- [x] 3.1 Create `src/app/router/index.ts` with Vue Router instance and route definitions: `/` (home), `/auth/email`, `/auth/verify-otp`, `/map`
- [x] 3.2 Create `src/features/auth/presentation/stores/auth-store.ts` Pinia store managing session state (`isAuthenticated`, `currentUser`, `isLoading`) with Supabase `onAuthStateChange` listener
- [x] 3.3 Implement `beforeEach` navigation guard in router: redirect unauthenticated users from `/map` to `/`, redirect authenticated users from `/` and `/auth/*` to `/map`
- [x] 3.4 Wire up Pinia and Router in `src/main.ts`, ensure auth store initializes before first navigation

## 4. Auth Pages

- [x] 4.1 Create `src/features/auth/presentation/pages/home-page.vue` — landing page with app title and "Login" button navigating to `/auth/email`
- [x] 4.2 Create `src/features/auth/presentation/pages/email-entry-page.vue` — email input form with validation, calls Supabase `signInWithOtp`, navigates to `/auth/verify-otp`
- [x] 4.3 Create `src/features/auth/presentation/pages/verify-otp-page.vue` — 8-char OTP input, calls Supabase `verifyOtp`, resend button, error display
- [x] 4.4 Write unit tests for auth store (session check, sign out, auth state changes)

## 5. User Profile Feature

- [x] 5.1 Create `src/features/user/data/models/user-profile-schema.ts` — Zod schema for user profile with snake_case to camelCase transform
- [x] 5.2 Create `src/features/user/domain/entities/user-profile.ts` — TypeScript interface inferred from Zod schema
- [x] 5.3 Create `src/features/user/domain/repositories/user-profile-repository.ts` — abstract repository interface
- [x] 5.4 Create `src/features/user/data/repositories/user-profile-repository-impl.ts` — Supabase implementation with `getUserById`, `upsertProfile` methods
- [x] 5.5 Create `src/features/user/presentation/stores/user-profile-store.ts` — Pinia store with auto-load on auth, clear on sign-out
- [x] 5.6 Create `src/features/user/presentation/components/user-profile-sheet.vue` — displays name/email, sign-out button
- [x] 5.7 Write unit tests for user profile store and repository

## 6. Contacts Feature

- [x] 6.1 Create `src/features/contacts/data/models/contact-schema.ts` — Zod schema for contact
- [x] 6.2 Create `src/features/contacts/domain/entities/contact.ts` — TypeScript interface
- [x] 6.3 Create `src/features/contacts/domain/repositories/contacts-repository.ts` — abstract interface
- [x] 6.4 Create `src/features/contacts/data/repositories/contacts-repository-impl.ts` — Supabase implementation with `fetchContacts`, `createContact`
- [x] 6.5 Create `src/features/contacts/presentation/stores/contacts-store.ts` — Pinia store with auto-load, `addContact`, clear on sign-out
- [x] 6.6 Create `src/features/contacts/presentation/components/contact-chip.vue` — toggleable chip showing resolved display name
- [x] 6.7 Create `src/features/contacts/presentation/components/contact-creation-dialog.vue` — form with firstName (required), lastName, displayName
- [x] 6.8 Write unit tests for contacts store and repository

## 7. Tours Feature

- [x] 7.1 Create `src/features/tours/data/models/tour-schema.ts` — Zod schema for tour, including `toGeoJsonFeature` utility
- [x] 7.2 Create `src/features/tours/domain/entities/tour.ts` — TypeScript interface and TourDraft type
- [x] 7.3 Create `src/features/tours/domain/repositories/tours-repository.ts` — abstract interface
- [x] 7.4 Create `src/features/tours/data/repositories/tours-repository-impl.ts` — Supabase implementation with `createTourWithPartners` (RPC) and `listToursForUser` (tours_view)
- [x] 7.5 Create `src/features/tours/presentation/stores/tours-store.ts` — Pinia store with auto-load, `createTourFromDraft`, clear on sign-out
- [x] 7.6 Create `src/features/tours/presentation/components/tour-creation-dialog.vue` — form with optional name, date picker, contact chip partner selection
- [x] 7.7 Create `src/features/tours/presentation/components/tour-info-sheet.vue` — displays tour name, date, coordinates, partner chips
- [x] 7.8 Write unit tests for tours store and repository

## 8. Map Integration

- [x] 8.1 Copy `swisstopo_wmts_style.json` from Flutter assets to `public/swisstopo_wmts_style.json`
- [x] 8.2 Create `src/features/map/data/swisstopo-styles.ts` — map style constants (base URL + full color JSON path)
- [x] 8.3 Create `src/features/map/presentation/stores/map-store.ts` — Pinia store with `isPickingLocation`, `currentStyleIndex`, `selectedTourId`
- [x] 8.4 Create `src/features/map/presentation/components/touringbuddy-map.vue` — initializes MapLibre map on mount, destroys on unmount, centers on Switzerland
- [x] 8.5 Create `src/features/map/presentation/components/tours-marker-layer.ts` — composable/utility that adds GeoJSON source + circle layer for tours, handles click events, manages selected tour highlighting
- [x] 8.6 Create `src/features/map/presentation/components/location-picker.vue` — crosshair overlay with cancel/continue FABs, captures map center on confirm
- [x] 8.7 Create `src/core/components/crosshair.vue` — SVG crosshair centered in viewport
- [x] 8.8 Create `src/features/map/presentation/components/map-action-overlay.vue` — FAB column: style picker, profile, add contact, add location; hidden during location picking
- [x] 8.9 Create `src/features/map/presentation/components/base-map-picker.vue` — popup menu listing styles with checkmark on active
- [x] 8.10 Create `src/features/map/presentation/pages/map-page.vue` — composes map, overlay, location picker, tour info sheet, and dialogs
- [x] 8.11 Write unit tests for map store

## 9. Shared Components

- [x] 9.1 Create `src/core/components/error-snackbar.vue` — error notification component
- [x] 9.2 Create `src/core/components/round-action-button.vue` — circular FAB with icon slot
- [x] 9.3 Create `src/core/composables/use-snackbar.ts` — composable for showing error/success snackbars

## 10. PWA Support

- [x] 10.1 Configure `vite-plugin-pwa` in `vite.config.ts` with manifest (name, icons, theme color, start URL), `registerType: 'prompt'`, and Workbox `generateSW`
- [x] 10.2 Add Workbox runtime caching rule for Swisstopo tile URLs with `StaleWhileRevalidate` strategy
- [x] 10.3 Create `src/core/components/pwa-install-banner.vue` — listens for `beforeinstallprompt`, shows install banner, handles accept/dismiss
- [x] 10.4 Integrate PWA install banner into `App.vue`

## 11. Integration & Polish

- [x] 11.1 Verify full auth flow works end-to-end: home → email → OTP → map page
- [x] 11.2 Verify tour creation flow: location pick → tour dialog → marker appears on map
- [x] 11.3 Verify contact creation and selection in tour dialog
- [x] 11.4 Verify map style switching between Base and Full Color
- [x] 11.5 Run `npm run lint` and `npm run format` — fix all issues
- [x] 11.6 Run `npm run type-check` — fix all type errors
- [x] 11.7 Run `npm run test` — all tests pass
