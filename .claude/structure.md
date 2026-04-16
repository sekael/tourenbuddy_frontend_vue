## Project Structure

```
src/
  app/                              # App-level config
    router/                         # Vue Router config, route definitions, auth guards
    theme/                          # CSS custom properties, design tokens, typography
  core/                             # Shared across all features
    constants/                      # App-wide constants
    utils/                          # Utility functions
    exceptions/                     # Custom error classes
    logging/                        # Logger composable, log formatter
    composables/                    # Shared composables (useBreakpoint, useSnackbar, etc.)
    components/                     # Shared reusable components (Crosshair, ErrorSnackbar, etc.)
  features/                         # Feature modules — each self-contained
    feature_name/
      data/
        services/                   # Supabase calls, IndexedDB access
        models/                     # Zod schemas + inferred TypeScript types
        repositories/               # Repository implementations
      domain/
        entities/                   # Business object types (pure TypeScript, no framework deps)
        repositories/               # Abstract repository interfaces (TypeScript interfaces)
      presentation/
        stores/                     # Pinia stores (composition API setup stores)
        pages/                      # Full-page Vue components (routed views)
        components/                 # Feature-specific Vue components
test/                               # Unit & component tests, mirrors src/ structure
e2e/                                # Playwright E2E tests
```

## Key Dependencies

```json
{
  "dependencies": {
    "vue": "^3.5",
    "pinia": "^3.0",
    "vue-router": "^4.5",
    "@supabase/supabase-js": "^2.49",
    "maplibre-gl": "^5.4",
    "zod": "^3.24",
    "consola": "^3.4",
    "vee-validate": "^4.15",
    "@vueuse/core": "^12.8"
  },
  "devDependencies": {
    "vite": "^6.3",
    "typescript": "^5.8",
    "vue-tsc": "^2.2",
    "@antfu/eslint-config": "^4.13",
    "prettier": "^3.5",
    "vitest": "^3.1",
    "@vue/test-utils": "^2.4",
    "playwright": "^1.52",
    "unplugin-vue-router": "^0.12",
    "vite-plugin-pwa": "^1.0",
    "@vitejs/plugin-vue": "^5.2"
  }
}
```

