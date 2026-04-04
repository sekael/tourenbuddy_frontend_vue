## Why

The TouringBuddy app currently exists as a Flutter frontend. We need to rewrite it as a Vue 3 application to align with the chosen web-first technology stack (Vue 3 + TypeScript + Vite). The Vue project has been architected (CLAUDE.md, ARCHITECTURE.md) but has zero source code — this change implements the full application by translating all Flutter features to their Vue equivalents.

## What Changes

- **Project scaffolding**: Initialize `package.json`, Vite config, TypeScript config, ESLint/Prettier, and the `src/` directory structure
- **Core infrastructure**: Environment validation (Zod), Supabase client initialization, logger composable, theme/design tokens as CSS custom properties, Vue Router setup with auth guards
- **Auth feature**: Email entry page, OTP verification page, auth gate (reactive redirect based on Supabase auth state), Pinia auth/user store
- **User profile feature**: User profile model (Zod schema), repository, store, and profile sheet component with sign-out
- **Contacts feature**: Contact model, repository, store, contact creation dialog, contact chip component for tour partner selection
- **Tours feature**: Tour model, repository (Supabase RPC `create_tour_with_partners` + `tours_view`), store, tour creation dialog with date picker and partner selection, tour info display
- **Map feature**: MapLibre GL JS integration with Swisstopo vector tiles (base + full color styles), tour marker layer (circles), location picker with crosshair overlay, map action overlay with FABs (style picker, profile, add contact, add location)
- **PWA support**: `vite-plugin-pwa` configuration with install prompt banner
- **Shared components**: Crosshair SVG overlay, error snackbar, round action buttons

## Capabilities

### New Capabilities

- `project-scaffolding`: Vite + TypeScript + ESLint + Prettier project setup, directory structure, env validation
- `auth`: Email/OTP authentication flow with Supabase, auth guard, session management
- `user-profile`: User profile CRUD with Supabase, profile display sheet, sign-out
- `contacts`: Contact management (create, list), contact chips for partner selection
- `tours`: Tour creation with location, date, and partners; tour listing; tour info display
- `map-integration`: MapLibre GL JS with Swisstopo tiles, style switching, tour markers, location picker, action overlay
- `pwa-support`: PWA manifest, service worker config, install prompt banner

### Modified Capabilities

_(none — greenfield project, no existing specs)_

## Impact

- **Dependencies**: All packages listed in CLAUDE.md `Key Dependencies` will be installed (Vue 3, Pinia, Vue Router 4, Supabase JS, MapLibre GL JS, Zod, Consola, VeeValidate, VueUse, etc.)
- **Backend**: No backend changes — the Vue app consumes the same Supabase tables (`tours_view`, `contacts`, `user_profile`) and RPC functions (`create_tour_with_partners`) as the Flutter app
- **CI/CD**: GitHub Actions workflows for lint/test/build will be needed but are out of scope for this change (tracked separately)
- **Environment**: Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables
