# Tasks

## 1. Git Setup

- [x] 1.1 Create feature branch from latest `main` (`git fetch origin && git checkout main && git pull && git checkout -b feat/326-self-hosted-ski-routes`) and verify `git branch --show-current` prints it

## 2. Dataset pipeline

- [x] 2.1 Add `scripts/ski-routes/build.mjs` (D3): reads the `ogr2ogr` GeoJSONSeq, writes `routes/<id>.json`, the slim tile input, `ski-routes.json` (TileJSON + `version` + `count`) and `_headers`; verify locally with GDAL/tippecanoe that the output has 2,941 route files, tiles only z11–z13, and logs avg/max tile size per zoom
- [x] 2.2 Add sanity gate to the script (count within ±30% of previous manifest, `sacid` non-null and unique, every tile id has a route file, no tile > 50 KB) and verify it fails on a truncated input
- [x] 2.3 Add `.github/workflows/ski-route-data.yml` (D4): weekly cron + `workflow_dispatch(force)` (force skips only the count check), STAC-vs-manifest check, build, `wrangler pages project create || true`, `wrangler pages deploy`, keepalive `gh workflow enable`; build writes the previous-version `_redirects` line (D9); after merge (2b.2), verify that `https://tourenbuddy-data.pages.dev/ski-routes.json` serves with `Access-Control-Allow-Origin: *` and a tile + route file load; after a second (forced) deploy, verify with `curl -I -H 'Origin: https://touringbuddy.pages.dev'` that an old-version tile URL answers 302 **with** `Access-Control-Allow-Origin` (record the result in the runbook; if missing, D9 step 2 alone covers it)
- [x] 2.4 Make the keepalive step run on every path (`if: always()`); verify in the first run's log that `gh workflow enable` succeeds. Long-term check (not blocking archive, in Workflow follow-up): ~2 months after merge, `gh api repos/sekael/tourenbuddy_frontend_vue/actions/workflows/ski-route-data.yml --jq .state` must be `active`
- [x] 2.5 Write the runbook `docs/ski-route-data.md` (what the data project/workflow/keepalive are; which gate failed → what to do: count jump → re-run with `force`, uniqueness/completeness/size → fix the build script; workflow disabled → one-click re-enable, then bot-commit keepalive (D4); how to verify a deploy) and add a pointer to it in `.claude/env-ci.md`; verify the runbook names the workflow file, Pages project and every gate

## 2b. Finalize PR 1 (data pipeline)

- [ ] 2b.1 Run `npx eslint . --fix` and `npx eslint` (zero warnings); prompt the user to commit (e.g. `feat(ski-routes): publish self-hosted ski-route dataset`), push and open PR 1 referencing #326
- [ ] 2b.2 After merge: trigger `ski-route-data.yml` via `workflow_dispatch`; verify the data URL + CORS + Content-Type/compression (runbook → Verifying a deploy) and that the Keepalive step succeeded; later, after a second version, the 302 + CORS check (record in runbook); then branch PR 2 from the updated `main`

## 3. Client data layer

- [ ] 3.1 Add `SKI_ROUTES_TILEJSON` to `trail-overlays.ts`; replace `identifySkiRoutes` in `swisstopo-trail-service.ts` with `fetchSkiRoute({ url, locale, signal })` reusing `mapSkiRoute` + Zod; update `swisstopo-trail-service.test.ts` for non-OK, invalid JSON, abort and timeout, and verify `npm run test` passes
- [ ] 3.2 Export the grade color stops from `ski-badge.ts` and derive the badge color from the label in `styleimagemissing`; verify a test that halo stops and `gradeColor` agree at each grade

## 4. Map layers and tap resolution

- [ ] 4.1 `trail-layers.ts`: vector source from the TileJSON, halo (difficulty `interpolate`) and badges both `minzoom` 11 with locale-dependent `icon-image`, visibility tied to the ski overlay; remove `setClickable`; verify on the dev server that halos/badges render from z11 (not at z10.9) and survive a base-map switch
- [ ] 4.2 Remove `clickableTrails` from `map-store`, `tourenbuddy-map.vue` and `map-page.vue` (`syncClickableTrails`, `moveend` refresh); verify `npm run type-check` passes
- [ ] 4.3 `use-trail-lookup.ts`: `queryRenderedFeatures` on the halo, then the dedupe/rank step (**user's gap**: fragments → per-id min distance → tolerance filter → nearest first, 8 + `more`), then parallel route-file fetch with abort/supersede; update `use-trail-lookup.test.ts` for duplicate fragments, out-of-tolerance, >8 hits, failed fetch and superseded tap; verify `npm run test` passes
- [ ] 4.3b Add `refreshSkiManifest()` + ski-source `error` listener and the route-file 404 → refresh → retry-once → silent-miss path (D9); tests for retry success, removed route (no card, no snackbar) and throttling; verify `npm run test` passes
- [ ] 4.4 `map-page.vue`: `zoom < 11 → closeOverlay()`; offline hit on a marked route → `map.trail.offline` snackbar (new key in `en.json` + `de-CH.json`), offline miss → close; remove `map.trail.zoomIn` from both locales and the unused `info` snackbar tone; update `map-page.test.ts` (below z11: no lookup, no snackbar; offline hit: snackbar, no fetch; offline miss: nothing); verify `npm run check:locales` and `npm run test` pass
- [ ] 4.5 Check the onboarding map-layers step still matches (no zoom-in hint, ski tap still reachable) and walk it end-to-end on the dev server

## 5. Caching and offline

- [ ] 5.1 `sw.ts`: TileJSON `NetworkFirst`, tiles offline-cache-first then `CacheFirst`, route files `CacheFirst`, all in `ski-route-data` (3000/30 d); verify in DevTools that a second view of a tile and a route file makes no network request
- [ ] 5.2 `offline-map-cache.ts` `normalizeTileUrl` strips the `/ski-routes/<version>/` segment; add a unit test for it and verify it passes
- [ ] 5.3 `offline-tile-service.ts` downloads ski-route tiles (≤ z13) for the region from the cached TileJSON and counts them in the estimate; verify offline (DevTools) that a downloaded region marks routes and that tapping one shows the "needs a connection" snackbar

## 6. Finalize PR 2 (app)

- [ ] 6.1 Run `npx eslint . --fix`, then `npx eslint` (zero warnings), `npm run type-check` and `npm run test`; all pass
- [ ] 6.2 Prompt the user to commit with a ready-to-copy conventional commit message (e.g. `feat(map): serve ski routes from self-hosted vector tiles`)
- [ ] 6.3 Prompt the user to push and open PR 2 referencing #326 (PR 1's data must be live)

## Workflow follow-up

- Archive the change with `openspec-archive` after merge.
- ~2 months after merge: check the workflow state is `active`; record the result in `docs/ski-route-data.md`. If `disabled_inactivity`: re-enable and switch the keepalive to a bot commit (D4 option C).
