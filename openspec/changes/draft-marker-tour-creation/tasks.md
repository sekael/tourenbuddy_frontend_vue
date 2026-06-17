## 1. Git Setup

- [x] 1.1 Branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b feat/222-draft-marker-tour-creation`

## 2. Generalize preview state in map-store

- [x] 2.1 Rename `editPreviewGoal` → `previewGoal` and `setEditPreviewGoal` → `setPreviewGoal` in `map-store.ts`; update exports
- [x] 2.2 Add `previewTourType` ref + `setPreviewTourType(type)` action to `map-store.ts`
- [x] 2.3 Update all edit-mode call sites (`grep editPreviewGoal` — `map-page.vue`) to the new names

## 3. Wire preview rendering to explicit type

- [x] 3.1 In `tourenbuddy-map.vue`, watch `[previewGoal, previewTourType]` and call `updatePreview(previewGoal, previewTourType)` (drop the implicit `selectedTour.tourType` derivation in the preview watch + style.load + load paths)
- [x] 3.2 In edit mode, set `setPreviewTourType(selectedTour.tourType)` when the tentative goal pick starts so edit-mode color is unchanged

## 4. Surface the form's live activity type

- [x] 4.1 In `tour-form.vue`, emit `tourTypeChange` whenever `selectedTourType` changes (use the existing watch)
- [x] 4.2 In `tour-creation-dialog.vue`, re-emit `tourTypeChange` up to the page
- [x] 4.3 In `map-page.vue`, handle `tourTypeChange` by calling `mapStore.setPreviewTourType(type)`

## 5. Draft marker lifecycle during creation

- [x] 5.1 In `map-page.vue` `handleLocationConfirmed`, call `setPreviewGoal(location)` on the initial creation goal pick and on goal re-pick (both branches)
- [x] 5.2 Add the preview clear (`setPreviewGoal(null)` + `setPreviewTourType(null)`) to `resetTourCreationState()` so all cancel/dismiss paths (`closeOverlay`, `openOverlay` switching away) clear immediately
- [x] 5.3 Late clear on save: in `handleTourCreated`, after `closeOverlay()`, re-assert `setPreviewGoal(goal)` + `setPreviewTourType(draft.tourType)` using the already-captured `goal` so the colored draft stays visible through `performCreate`
- [x] 5.4 Clear the preview at the end of `performCreate` (after `createTourFromDraft` resolves, real marker now in store); use a `finally`/early-return-safe path so a failed create still clears the draft

## 6. Tests

- [x] 6.1 Add/extend map-store unit test: `setPreviewGoal`/`setPreviewTourType` set and clear correctly (edge cases: clearing to null)
- [x] 6.2 Component/unit test for creation flow: goal re-pick moves the single preview goal (no second marker); cancel clears preview state; a failed `createTourFromDraft` still clears the preview (no dangling draft)
- [x] 6.3 `npm run test` — all pass

## 7. Manual verification (desktop)

- [x] 7.1 Create a tour on desktop: draft marker appears neutral on goal pick, recolors live when an activity type is chosen, moves on goal re-pick, stays visible through save and swaps to the real colored marker (no empty-map gap), disappears on cancel
- [x] 7.2 Edit an existing tour's goal: preview behavior unchanged
- [x] 7.3 Mobile sanity: draft marker visible during goal re-pick and after save (full-screen form covers it otherwise — expected)

## 8. Finalize

- [x] 8.1 Run `npx eslint . --fix` and `npm run type-check`; confirm zero warnings and review the diff size (editor format-on-save can fight antfu style)
- [ ] 8.2 Prompt the user to commit with message: `feat(map): show draft tour marker during tour creation (#222)`
- [ ] 8.3 Prompt the user to push and open a PR; remind them to archive the change with `openspec archive` after merge
