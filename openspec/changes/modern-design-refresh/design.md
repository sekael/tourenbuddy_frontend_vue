## Context

TouringBuddy's current UI is built with custom CSS using an orange Material 3 palette, system fonts, and emoji icons. The app has ~20 Vue components across auth, map, tours, contacts, and user-profile features. All styling is scoped CSS with design tokens in `src/app/theme/`. No CSS framework or icon library is in use.

The design refresh is purely presentational — all business logic, stores, services, routing, and data flow remain untouched.

## Goals / Non-Goals

**Goals:**

- Replace the orange palette with a blueish-grey (slate) color scheme plus blue accent
- Replace all emoji icons with Google Material Symbols Outlined
- Switch typography to Inter font with refined weight hierarchy
- Modernize component styling: softer radii, layered shadows, glassmorphism on map overlays, pill chips, drag handles on sheets
- Maintain all existing functionality and component APIs (props, emits)

**Non-Goals:**

- No component library adoption (Vuetify, PrimeVue, etc.) — keep custom CSS approach
- No dark mode implementation (future work)
- No layout restructuring or new pages/routes
- No changes to Pinia stores, Supabase services, or business logic
- No animation library (keep CSS transitions)

## Decisions

### 1. Google Material Symbols via CDN (not npm package)

Load Material Symbols Outlined from Google Fonts CDN in `index.html`. Icons render as `<span class="material-symbols-outlined">icon_name</span>`.

**Rationale**: Zero build-time cost, cached across Google properties, simple to use in templates. An npm icon package (like `@mdi/font` or `unplugin-icons`) adds build complexity for no benefit in this context — we only need ~12 distinct icons.

**Alternative considered**: SVG sprite sheet — more control but more maintenance and bundle overhead for a small icon set.

### 2. Inter font via Google Fonts CDN

Load Inter (weights 400, 500, 600) from Google Fonts alongside Material Symbols in a single `<link>` tag.

**Rationale**: Inter is designed for screen readability, widely used in modern apps, and free. Loading from CDN avoids self-hosting complexity. Three weights (regular, medium, semibold) cover all typography needs without excess.

**Alternative considered**: Self-hosted fonts via `@fontsource/inter` — better for offline/PWA but adds build step. CDN is acceptable since the app already requires network for Supabase and map tiles.

### 3. CSS custom properties for the complete design system

Keep the existing `tokens.css` / `typography.css` / `global.css` architecture. Replace values in-place rather than adding new files.

**Rationale**: The token-based approach is already well-structured. Changing values preserves the architecture and minimizes diff surface. Components already reference `var(--color-*)` so the palette swap propagates automatically for most colors.

### 4. Glassmorphism for map overlays only

Apply `backdrop-filter: blur()` with semi-transparent backgrounds only to map overlay controls (FABs, base map picker). Other components use standard opaque surfaces.

**Rationale**: Glassmorphism works well over map content (visually rich backgrounds) but looks odd over plain surfaces. Limiting it to map overlays keeps the effect purposeful.

### 5. Component-level styling updates (no shared utility classes)

Update each component's `<style scoped>` individually rather than introducing utility classes or a CSS framework.

**Rationale**: Matches the existing architecture. The component count is small (~20) and each has distinct styling needs. Utility classes would be premature abstraction.

## Risks / Trade-offs

- **CDN dependency for fonts/icons** → If Google Fonts is unreachable, Inter falls back to system fonts (already defined as fallback in font stack), Material Symbols degrades to empty spans. Acceptable for an app that requires network connectivity anyway. Mitigation: PWA precaching can cache font files for offline use in a future iteration.

- **Glassmorphism browser support** → `backdrop-filter` is supported in all modern browsers but has performance cost on older mobile GPUs. Mitigation: Keep blur radius modest (8-12px) and limit to map overlay elements only.

- **Large diff across many files** → Touching ~20 component files in one change increases review effort. Mitigation: Group implementation into logical tasks (theme first, then core components, then feature components) so each commit is reviewable in isolation.

- **Visual regression** → No visual regression testing is set up. Mitigation: Manual review of all pages/states after implementation. Consider adding Playwright visual snapshots as follow-up.
