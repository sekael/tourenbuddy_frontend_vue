## 1. Git Setup

- [x] 1.1 Create feature branch from latest main: `git fetch origin && git checkout main && git pull && git checkout -b fix/63-coordinate-offset`

## 2. Fix Coordinate Capture

- [x] 2.1 In `src/features/map/presentation/components/location-picker.vue`, extract a named helper `getCrosshairCoordinates(map)` that uses `map.unproject([canvas.clientWidth / 2, canvas.clientHeight / 2])` and replace the `map.getCenter()` call with it. The function name makes it clear we read the position under the visual crosshair, not the logical (potentially padded) map center. Add a JSDoc comment explaining why `getCenter()` is incorrect (padding offset).

## 3. Testing

- [x] 3.1 Add unit test verifying location picker uses `unproject()` with pixel center coordinates instead of `getCenter()`
- [x] 3.2 Run full test suite (`npm run test`) — all tests pass

## 4. Finalize

- [x] 4.1 Run `npm run lint` and `npm run format` — zero issues
- [ ] 4.2 Prompt user to commit with message: `fix(map): use pixel-center unproject for location capture (#63)`
- [ ] 4.3 Prompt user to push branch and create PR
