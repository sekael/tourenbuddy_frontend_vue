## Context

The Vue rewrite is being beta tested but has no in-app feedback path. The Flutter app's `map_page.dart` exposes a feedback button in the app bar that opens a bottom sheet with a "Open Issue on GitHub" button (linking to a beta feedback issue template) and a fallback email. We need parity on web while staying consistent with how the Vue app already structures overlays/sheets on the map page (profile, contacts, tour info).

## Goals / Non-Goals

**Goals:**

- Provide a one-tap entry point on the map screen to open the GitHub bug report template in a new tab.
- Provide a visible fallback (email) for users without a GitHub account.
- Surface a snackbar error if the new tab cannot be opened (popup blocker, etc.).
- Keep the feedback sheet reusable so it can later be embedded in other surfaces (e.g., user profile, error states).
- Preserve `map-action-overlay.vue` under the 150-line component budget.

**Non-Goals:**

- Building an in-app feedback form that submits directly to GitHub (requires auth/API token; out of scope for beta).
- Collecting telemetry, screenshots, or device metadata.
- Localizing copy beyond English (the rest of the app is currently English-only).
- Adding feedback entry points outside the map screen.

## Decisions

### Constants module: `src/core/constants/feedback.ts`

Hardcoding the GitHub URL inside a component would couple presentation to configuration and complicate testing. A small constants module exposes `FEEDBACK_GITHUB_ISSUE_URL` and `FEEDBACK_EMAIL`. **Alternative considered**: environment variables — rejected because the values are public, stable, and not deploy-specific, so `VITE_*` env churn is unwarranted.

### Reusable component: `src/core/components/feedback-sheet.vue`

Lives in `core/components/` (not `features/map/...`) because the sheet is presentation-only and has no map-specific dependencies. **Alternative considered**: inline the markup in `map-action-overlay.vue` — rejected because it pushes the overlay past the 150-line budget and prevents reuse.

### State ownership: `map-page.vue` owns visibility

`map-action-overlay.vue` emits `openFeedback`; `map-page.vue` keeps a `showFeedbackSheet` ref and renders `<FeedbackSheet>` inside a `<Transition name="sheet">` block, mirroring `UserProfileSheet` and `ContactCreationDialog`. **Alternative considered**: overlay owns its own sheet state via `<Teleport>` — rejected for inconsistency with existing patterns and harder testability.

### Opening the URL: `window.open(url, '_blank', 'noopener,noreferrer')`

Standard web pattern; `noopener,noreferrer` prevents the new tab from accessing `window.opener`. If the call returns `null` (popup blocked), we call `useSnackbar().showError(...)`. **Alternative considered**: `<a target="_blank">` — works but loses the ability to detect failure and trigger the snackbar.

### Logging

Use `useLogger('feedback-sheet')` to log when the user opens the issue link, matching the Flutter app's `logger.i('Launching Github issue URL: $url')`. No PII, no analytics events.

### Testing

Component test under `test/core/components/feedback-sheet.spec.ts` using Vue Test Utils. Stub `window.open` and `useSnackbar`. Cover: (a) primary button calls `window.open` with the constant URL; (b) when `window.open` returns `null`, snackbar error is shown; (c) email link uses the constant.

## Risks / Trade-offs

- **[Risk] Popup blockers may block `window.open` even though it's user-initiated** → Mitigation: snackbar fallback tells the user to email instead; the email is also visible inline in the sheet.
- **[Risk] `feedback-sheet.vue` lives in `core/components/` but has only one consumer today** → Trade-off: slight premature generalization, but the component is small and reuse is plausible (profile menu, error pages). Acceptable.
- **[Risk] Hardcoded repo URL drifts if the repo is renamed** → Mitigation: centralized in `feedback.ts`; one-line update.
- **[Risk] Duplication between `bug_report.md` issue template and any future structured form** → Out of scope; revisit if/when we move to a richer feedback flow.

## Migration Plan

No migration. Pure additive change. Rollback = revert the commit.

## Open Questions

- Should the feedback FAB be hidden behind a feature flag for production once beta ends? (Assuming no — keeping as a permanent affordance.)
