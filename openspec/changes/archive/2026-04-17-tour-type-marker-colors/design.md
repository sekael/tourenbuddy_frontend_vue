## Context

Tour markers are rendered as MapLibre circle layers with hard-coded paint properties (`circle-color: '#e65100'`) in `src/features/map/presentation/components/tours-marker-layer.ts`. The tour domain entity already carries a `tourType: TourType | null` field (11 enum values, in `src/features/tours/data/models/tour-type.ts`), but this field is not forwarded into the GeoJSON feature properties, so MapLibre cannot reference it. An edit-mode preview marker (a second circle layer backed by a separate `tours-preview` source) currently uses a static orange (`#ff9800`) to hint at "tentative" state.

## Goals / Non-Goals

**Goals:**

- Derive marker color from `tourType` via a data-driven MapLibre `match` expression (no per-tour layer duplication).
- Keep the "tentative" semantic of the preview marker by using a lighter shade of the same type color.
- Export a palette that other UI surfaces (chips, icons, legends) can reuse later.
- Zero data migration; works on existing tours including `null` types.

**Non-Goals:**

- Theming support (light/dark variants) — out of scope.
- Changing GPX track line color (hard-coded orange in `gpx-track-layer.ts`) — out of scope for this change; may follow up.
- Introducing a marker icon/shape per type — circles only.
- Per-type radius or stroke variations.
- Updating the tour form chip colors.

## Decisions

### 1. Color grouping: 3 buckets + fallback

| Group       | Types                                                            | Marker    | Preview (lighter) |
| ----------- | ---------------------------------------------------------------- | --------- | ----------------- |
| Winter      | skiing, snowboarding, skitour, splitboarding, ski-mountaineering | `#1565C0` | `#60A5FA`         |
| Paragliding | paragliding                                                      | `#D97706` | `#FCD34D`         |
| Summer      | hiking, mountaineering, climbing, mountain-biking, trailrunning  | `#DC2626` | `#FCA5A5`         |
| Unknown     | null / unrecognized                                              | `#78716C` | `#A8A29E`         |

Rationale: Issue #13 specifies blue/red/yellow groupings. One color per group (not per type) keeps the map legible — 11 distinct hues would be noisy and hard to distinguish at small circle sizes. The palette uses Tailwind-family tones for consistency with the existing design tokens (blue-700, amber-600, red-600, stone-500).

**Alternatives considered:** (a) Per-type unique color — rejected, too noisy. (b) Hue gradient within groups — rejected, adds complexity with no clear UX win.

### 2. Data-driven `match` expression (vs. multiple layers)

Use a single circle layer per role (default / selected / preview) with `circle-color` set to a MapLibre `match` expression on `['get', 'tourType']`. Wrap with `coalesce` so null values fall through to the unknown fallback.

**Alternatives considered:** Separate layer per color group — rejected, more setup, more `setFilter` calls, worse performance.

### 3. `tourType` carried in GeoJSON properties

Add `tourType: tour.tourType ?? null` to the output of `tourToGeoJsonFeature`. This is the minimal surface change to make the type reachable from MapLibre expressions.

### 4. Preview marker gets type from caller

The preview source holds a single feature. `updatePreview` signature changes from `(goal)` to `(goal, tourType)`. The caller (`tourenbuddy-map.vue`) passes `selectedTour.value?.tourType ?? null` — `selectedTour` is already computed there for the GPX layer. Preview layer uses its own `match` expression with the preview palette.

**Alternative considered:** Store `tourType` alongside `editPreviewGoal` in the map store. Rejected — the type is always derivable from the already-selected tour; adding it to the store duplicates state.

### 5. Palette location

Export `TOUR_TYPE_COLORS` and `TOUR_TYPE_PREVIEW_COLORS` as `Record<TourType, string>` from `src/features/tours/data/models/tour-type.ts` (alongside `TOUR_TYPE_LABELS` / `TOUR_TYPE_ICONS`). The MapLibre `match` expression is assembled from these records (not from inline hex strings) so there is one source of truth.

## Risks / Trade-offs

- **[Risk] Palette accessibility on Swisstopo base map.** → Mitigation: chosen tones have sufficient contrast against both the vector and WMTS raster styles; verify manually during QA with both styles. White stroke on the selected marker remains unchanged and preserves focus.
- **[Risk] Future tour types added to the enum without a color mapping.** → Mitigation: `Record<TourType, string>` is TypeScript-enforced; adding a type without a color will fail type-check.
- **[Trade-off] Three shades for 11 types means snowboarding and skiing look identical.** Acceptable — issue #13 explicitly groups by season, not by specific sport.
- **[Trade-off] Preview color is derived per-type, not a single "edit-mode orange". Users who associate orange specifically with "editing" may need to relearn.** Acceptable — the lighter-shade cue is the semantic ("this is tentative"), not the specific hue.

## Migration Plan

None. Stateless UI change. On deploy, all markers re-render with new colors on next map load. No DB changes, no feature flag.
