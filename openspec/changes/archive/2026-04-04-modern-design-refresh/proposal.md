## Why

The current UI uses an orange Material 3 palette and emoji icons, giving it a dated, informal appearance. Users expect a clean, modern, and professional interface. A blueish-grey color scheme with proper Material Symbols icons and refined typography will make the app feel sleek and trustworthy, matching contemporary design standards for outdoor/utility apps.

## What Changes

- **Color palette overhaul**: Replace the orange seed palette with a sophisticated blueish-grey (slate) scheme, adding a blue accent color for interactive elements
- **Icon system replacement**: Swap all emoji icons (🗺, 👤, 📍, etc.) for Google Material Symbols Outlined — a consistent, scalable icon font
- **Typography upgrade**: Switch from system font stack to Inter (Google Fonts) with lighter heading weights for a modern feel
- **Component visual refresh**: Update all components with softer radii, layered shadows, glassmorphism on map overlays, drag handles on sheets, and refined spacing
- **Input field refinement**: Cleaner bordered inputs with smooth focus transitions
- **Button styling**: Softer border-radius (12px), subtle hover scale transitions
- **Chip redesign**: Pill-shaped with subtle tint instead of solid fill when selected

## Capabilities

### New Capabilities

- `design-system`: Defines the blueish-grey color tokens, Inter typography, Material Symbols icon integration, and shared component styling patterns (shadows, glassmorphism, button/input/chip styles)

### Modified Capabilities

- `auth`: Visual refresh of home, email-entry, and verify-otp pages — layout and styling changes only, no behavior changes
- `map-integration`: Glassmorphism on map overlays, Material Symbols icons on FABs, updated location picker and base map picker styling
- `tours`: Updated tour-creation-dialog and tour-info-sheet with new design language, Material Symbols icons
- `contacts`: Pill-shaped contact-chip design, updated contact-creation-dialog styling
- `user-profile`: Refreshed profile sheet with Material Symbols icons and updated avatar styling

## Impact

- **Theme files**: `tokens.css`, `typography.css`, `global.css` — full rewrite of design tokens
- **External dependencies**: Google Fonts (Inter) and Material Symbols Outlined added via CDN in `index.html`
- **All Vue components**: Every component's `<style>` and icon references updated (~20 files)
- **No logic/behavior changes**: All stores, services, routing, and business logic remain untouched
- **No breaking API changes**: Pure presentation-layer refactor
