# Testing

- ALWAYS test edge cases and failure scenarios
- NEVER test happy path (everything successful)
- Keep tests brief anc concise for faster execution
- Vitest + happy-dom. Test files mirroring `src/` structure under `test/`
- Mock abstract repository interfaces, never concrete implementations
- Pinia stores: `createTestingPinia()` for component tests, direct instantiation for unit tests
- Test file location: `src/features/tours/...` → `test/features/tours/...`
- Descriptive names: `'should return user when credentials are valid'`
- Run `npm run test` after every implementation — all must pass
- Playwright installed but no E2E config or tests yet
