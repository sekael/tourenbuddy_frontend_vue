# Testing

- Vitest + happy-dom. 29 test files mirroring `src/` structure under `test/`
- Mock abstract repository interfaces, never concrete implementations
- Pinia stores: `createTestingPinia()` for component tests, direct instantiation for unit tests
- Test file location: `src/features/tours/...` → `test/features/tours/...`
- Descriptive names: `'should return user when credentials are valid'`
- Run `npm run test` after every implementation — all must pass
- Playwright installed but no E2E config or tests yet
