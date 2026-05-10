# TourenBuddy Frontend (Vue)

Vue 3 tour-planning app. Users pin tour objectives on Swiss topo map (Swisstopo), associate contacts, select planned dates.

## Stack

- **Framework:** Vue 3 + TypeScript, `<script setup>` SFCs
- **Build:** Vite 6, deploy to Cloudflare Pages, PWA via `vite-plugin-pwa`
- **State:** Pinia 3 composition stores (`defineStore` setup syntax)
- **Routing:** Vue Router 4, manual route definitions in `src/app/router/index.ts`
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth via email/OTP) — use `@supabase/supabase-js` directly, no Axios
  - IMPORTANT: ALL DB changes (schema/RLS/functions/storage) MUST go through migrations in `supabase/migrations/`, applied to LOCAL DB first, pushed to prod only after verification. See `.claude/conventions.md` → Supabase / Database
- **Map:** MapLibre GL JS with Swisstopo vector/WMTS tiles (free, no API key)
- **Testing:** Vitest + happy-dom for unit/component tests. Playwright installed but no E2E config yet
- **Linting:** ESLint `@antfu/eslint-config` (strict) + Prettier (no semicolons, single quotes, 100 char width)
- **Logging:** `useLogger` composable wrapping `consola` — no `console.log()`
- **Validation:** Zod for runtime validation + type inference
- **Phone:** `libphonenumber-js` for parsing/formatting (default region CH)

## Planning & Thinking

- IMPORTANT: For any new feature or non-trivial change, specification-driven development MUST ALWAYS be applied
- Start with OpenSpec skills:
  - **DEFAULT**: `openspec-propose` — propose change with all artifacts in one step
  - Wait for explicit user approval before implementing with `openspec-apply` skill
  - Prompt user to archive completed task with `openspec-archive` skill
- Simple task touching >3 files → still produce brief plan

## Key Commands

```bash
npm run dev          # dev server
npm run test         # all tests
npm run type-check

npx eslint           # zero warnings — enforced in CI
```

## Key Docs

- Architecture: @.claude/architecture.md
- Workflow: @.claude/workflow.md
- Conventions: @.claude/conventions.md
- Environment & CI: @.claude/env-ci.md
- Structure: @.claude/structure.md
- Testing: @.claude/testing.md

## Important Context

- Supabase free tier — expect higher auth latency
- Swisstopo free WMTS vector tiles, no API key needed
- PWA caches assets + map tiles only — no offline-first data sync
- Backlog: https://github.com/users/sekael/projects/1
- Values: thoughtful development, understand before changing, small reviewable PRs
