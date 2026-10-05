# Project Structure

```
src/
  app/
    router/index.ts           # Manual route definitions + auth guards
    theme/                    # global.css, tokens.css, typography.css
  core/
    components/               # Shared UI: bottom-sheet, crosshair, snackbar, drawer, etc.
    composables/              # use-snackbar, use-is-desktop, use-as-you-type-phone
    constants/                # env.ts (Zod-validated), feedback.ts
    exceptions/               # Custom error classes (4 types)
    logging/                  # use-logger (consola wrapper)
    utils/                    # supabase client, phone-normalize, wgs84-to-lv95
  features/
    auth/                     # Email/OTP auth (presentation only, no domain layer)
    contacts/                 # Full DDD: entities, repos, vCard import, phone actions
    map/                      # MapLibre integration, Swisstopo styles, marker layers
    tours/                    # Full DDD: GPX parsing, Swisstopo elevation/name services
    user/                     # Full DDD: profile management, phone verification
test/                         # Mirrors src/ structure
e2e/                          # Playwright (not configured yet)
```

## Feature Internal Structure (full DDD)

```
feature_name/
  data/
    models/                   # Zod schemas + inferred types
    repositories/             # Implementations (Supabase)
    services/                 # External API calls (if needed)
  domain/
    entities/                 # Pure TypeScript business objects
    repositories/             # Abstract interfaces
  presentation/
    stores/                   # Pinia composition stores
    pages/                    # Routed page components
    components/               # Feature-specific components
    composables/              # Feature-specific composables (if needed)
```
