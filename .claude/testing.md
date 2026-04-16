## Testing Requirements

- Min test types per feature: unit tests for domain/data logic, component tests for UI
- Vitest built-in mocking for deps — mock abstract repository interfaces, never concrete implementations
- Test Pinia stores via `createTestingPinia()` for component tests, direct store instantiation for unit tests
- Test file location mirrors source: `src/features/tours/...` → `test/features/tours/...`
- Descriptive test names: `'should return user when credentials are valid'`
- Run `npm run test` after every implementation — all tests must pass
