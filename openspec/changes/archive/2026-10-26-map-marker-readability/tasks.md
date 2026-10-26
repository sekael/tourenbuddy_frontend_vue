# Tasks

## 1. Git Setup

- [x] 1.1 Create branch `feat/map-marker-clustering-review` from local `main` (container cannot `git fetch`); verify with `git branch --show-current`

## 2. Cluster engine

- [x] 2.1 Nearest-neighbour cache in `buildClusterTree` (D3); verify the equivalence test against the exhaustive search passes and 600 tours build in < 100 ms
- [x] 2.2 Content-hashed cluster ids (D2); verify a cluster-tree test: removing one leaf keeps the ids of clusters not containing it
- [x] 2.3 Pin the selected tour out of the tree in `updateTours` (D2); verify a marker-layer test that the selected id renders individually

## 3. Marker taps and cluster tap

- [x] 3.1 `stopPropagation` on cluster marker and stack-row clicks (D1); verify in the headless walk that a stack row opens the sheet and it stays open
- [x] 3.2 Cluster tap fits its leaves; `STACK_ZOOM = 17` routes stacks to the list (D6); verify marker-layer tests for both branches
- [x] 3.3 Replace `spiderfy.ts` with a stack-list popup (D7), delete spiderfy + its spec; verify tests for ordering, row select, Escape/focus

## 4. Marker anatomy and labels

- [x] 4.1 Generic `loadSvgImage`; activity glyph images rendered from the icon registry; glyph symbol layer; white ring (D5); verify in walk screenshots
- [x] 4.2 Completion / friend / link corner badges replace full-size glyphs (D5); verify in walk screenshots
- [x] 4.3 `describeTour` callback + `label`/`labelSub` feature properties; `tours-labels` (minzoom 11) and `tours-labels-focus` layers (D4); verify unit test for `labelSub` and walk at z12
- [x] 4.4 Add glyph range 8192-8447 to offline glyph ranges; verify offline-tile-service test
- [x] 4.5 Start/end labels on the detail source (D9); verify walk screenshot of an open tour
- [x] 4.6 Cluster pie restyle (D10); verify pie-marker test still passes and walk screenshot

## 5. Outing chains and legend

- [x] 5.1 Outing chain source/layer fed from `tourenbuddy-map.vue`, excluding the open outing (D8); verify unit test for the chain builder and walk screenshot
- [x] 5.2 `map-legend.vue` in the layers panel, derived from `TOUR_TYPE_COLORS` (D11); verify component test and walk screenshot
- [x] 5.3 Locale keys in `en.json` + `de-CH.json`; update the onboarding map-layers step copy to mention the legend; verify `npm run check:locales`

## 6. Review rounds

- [x] 6.1 Re-run both reviewer personas against the new build; iterate until both report HAPPY

## 7. User review

- [x] 7.1 Legend badge glyphs sized to the badge (BaseIcon's own 20 px wins over inherited size); verify in walk screenshot
- [x] 7.2 Open tour/outing has the map to itself (D15); chains hidden meanwhile; verify marker-layer tests and walk screenshot
- [x] 7.3 Cluster fit, by-a-level centring and stack pan beside the drawer/sheet (D16); verify marker-layer tests and desktop walk
- [x] 7.4 Shared `FLIGHT_SPEED` for cluster taps, framing and place search (D17); verify picker/frame tests
- [x] 7.5 Six-group palette (D18) in markers, tracks, previews; legend sample pair; verify palette validator and tests
- [x] 7.6 Escape closes the side drawer (D19); inner Escape consumers call `preventDefault`; verify side-drawer tests
- [x] 7.7 Scene swap on a change of what has the map (D20): fade out markers, tracks and DOM markers, draw while hidden, fade in once drawn; verify marker-layer tests and a frame-by-frame walk of stage switches
- [x] 7.8 Short hops glide (D21) via `moveCalmly` for framing and cluster taps; verify frame-tour and marker-layer tests
- [x] 7.9 Names yield to markers, clusters and start/end points (D22); verify marker-layer test and the Piz Bernina / Piz Palü walk
- [x] 7.10 Local demo stacks for Patrick (Allalinhorn ×4, Säntis ×3 + Altmann, Piz Bernina ×2); verify stack list and "+N" chip in a walk
- [x] 7.11 Stay put when already shown (D23): framing skips a view that already shows the tour; the stack list pans only by its overrun; verify frame-tour and marker-layer tests and a camera-move probe cycling Säntis on desktop and phone
- [x] 7.12 Cluster taps keep the tours in the middle half (D24); verify marker-layer test and the Säntis + Altmann walk
- [x] 7.13 Collision-free cluster ids (D2): avalanche each leaf hash; repaint a kept cluster whose look changed; verify cluster-tree and marker-layer regressions fail before the fix, and Patrick's Alps view shows both stacks in their own colours

## 8. Finalize

- [x] 8.1 `npx eslint . --fix`, `npx eslint` (zero warnings), `npm run type-check`, `npm run test` all pass
- [x] 8.2 Prompt the user to commit with a ready-to-copy conventional commit message
- [x] 8.3 Prompt the user to push and open a PR

## Workflow follow-up

- Archive with `openspec-archive` after merge.
