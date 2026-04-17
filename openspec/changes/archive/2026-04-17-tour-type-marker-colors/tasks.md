## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main`: `git fetch origin && git checkout main && git pull && git checkout -b feat/13-tour-type-marker-colors`

## 2. Color palette

- [x] 2.1 In `src/features/tours/data/models/tour-type.ts`, add `TOUR_TYPE_COLORS: Record<TourType, string>` with winter types → `#1565C0`, paragliding → `#D97706`, summer types → `#DC2626`
- [x] 2.2 In the same file, add `TOUR_TYPE_PREVIEW_COLORS: Record<TourType, string>` with winter types → `#60A5FA`, paragliding → `#FCD34D`, summer types → `#FCA5A5`
- [x] 2.3 Export both records

## 3. Carry tourType into GeoJSON

- [x] 3.1 In `src/features/tours/domain/entities/tour.ts`, extend `tourToGeoJsonFeature` properties to include `tourType: tour.tourType ?? null`

## 4. Data-driven paint expressions

- [x] 4.1 In `src/features/map/presentation/components/tours-marker-layer.ts`, build `COLOR_EXPR` (MapLibre `match` on `['coalesce', ['get', 'tourType'], 'unknown']`) sourced from `TOUR_TYPE_COLORS` with grey fallback `#78716C`
- [x] 4.2 Build `PREVIEW_COLOR_EXPR` analogously from `TOUR_TYPE_PREVIEW_COLORS` with fallback `#A8A29E`
- [x] 4.3 Replace `circle-color: '#e65100'` on the default `tours-circles` layer with `COLOR_EXPR`
- [x] 4.4 Replace `circle-color: '#e65100'` on the `tours-circles-selected` layer with `COLOR_EXPR`
- [x] 4.5 Replace `circle-color: '#ff9800'` on the `tours-preview-circle` layer with `PREVIEW_COLOR_EXPR`

## 5. Pass tour type to preview

- [x] 5.1 Change `updatePreview` signature in `tours-marker-layer.ts` to `(goal: { lng: number, lat: number } | null, tourType: TourType | null)` and include `tourType` in the preview feature's `properties`
- [x] 5.2 In `src/features/map/presentation/components/tourenbuddy-map.vue`, update the initial `markerLayer.updatePreview(editPreviewGoal.value)` call and the call inside `watch(editPreviewGoal, ...)` to pass `selectedTour.value?.tourType ?? null` as second argument
- [x] 5.3 Update the style-change handler (same file, line ~98) to pass the tour type too

## 6. Tests

- [x] 6.1 Add/extend a unit test asserting `TOUR_TYPE_COLORS` and `TOUR_TYPE_PREVIEW_COLORS` cover every `TOUR_TYPE_VALUES` entry (TypeScript already enforces, but test guards against runtime drift)
- [x] 6.2 Run `npm run test` — all existing tests must still pass

## 7. Manual QA

- [x] 7.1 `npm run dev` → create tours of each group (one winter, one summer, one paragliding, one with `null` type) and confirm each renders in the expected color
- [x] 7.2 Enter edit mode on a winter tour, tap a new goal location, confirm light-blue preview circle appears; repeat for summer (light red) and paragliding (light amber)
- [x] 7.3 Verify selected marker (larger radius + white stroke) picks up the type color correctly
- [x] 7.4 Check contrast on both "Base" vector and "Full Color" WMTS Swisstopo styles

## 8. Finalize

- [x] 8.1 Run `npm run lint` — zero warnings
- [x] 8.2 Run `npm run format`
- [x] 8.3 Run `npm run type-check`
- [x] 8.4 Prompt the user to stage and commit with message:

  ```
  feat(map): color-code tour markers by tour type

  Closes #13
  ```

- [x] 8.5 Prompt the user to push the branch and open a PR against `main`, linking issue #13
