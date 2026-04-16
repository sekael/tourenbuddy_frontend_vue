# TourenBuddy Frontend (Vue)

Vue 3 tour-planning app. Users pin tour objectives on Swiss topo map (Swisstopo), associate contacts, select planned dates.

## General Principles

- Use subagents aggressively for delegatable tasks, use Haiku model for non-complex subagent tasks
- Opus 4.6 for planning/thinking/specs, Sonnet 4.6 for code implementation

## Stack

- **Framework:** Vue 3 (latest stable) with TypeScript and `<script setup>` SFCs
- **Build tool:** Vite (latest stable)
- **Targets:** Web (primary, Cloudflare Pages), PWA via `vite-plugin-pwa`
- **State management:** Pinia composition API stores (`defineStore` setup syntax)
- **Routing:** Vue Router 4 with typed routes (`unplugin-vue-router`) + auth navigation guards
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth via email/OTP) — use `@supabase/supabase-js` directly in composables/services, do NOT wrap with Axios
- **Map:** MapLibre GL JS (`maplibre-gl`) with Swisstopo vector tiles (WMTS)
- **Testing:** Vitest for unit/integration, Vue Test Utils for components, Playwright for E2E
- **Linting:** ESLint with `@antfu/eslint-config` (strictest) + Prettier
- **Logging:** Custom `useLogger` composable wrapping `consola` — no `console.log()` in production
- **Validation:** Zod for runtime validation and type inference

## Planning & Thinking

- IMPORTANT: For any new feature or non-trivial change, specification-driven development MUST ALWAYS be applied
- Start with OpenSpec skills:
  - **DEFAULT**: `openspec-propose` — propose change with all artifacts in one step. Use when user wants to describe what to build and get complete proposal with design, specs, tasks.
  - `openspec-explore` — thinking partner for exploring ideas, investigating problems, clarifying requirements. Use when user wants to think through something before/during a change.
- Wait for explicit user approval before implementing with `openspec-apply` skill
- Prompt user to archive completed task with `openspec-archive` skill
- Simple task touching >3 files → still produce brief plan
- **Git workflow tasks MANDATORY in every task list:**
  - FIRST task group MUST be "Git Setup" with branch creation from latest `main` (`feat/<issue-number>-<description>`)
  - LAST task group MUST be "Finalize" with lint/format, prompt user to commit (ready-to-copy message), prompt user to push and create PR

## Key Commands
```bash
npm run dev          # dev server
npm run test         # all tests
npm run lint         # zero warnings — enforced in CI
npm run format       # enforced in CI
npm run type-check
```

## Key Docs (reference when relevant)
- Architecture & data flow:    @.claude/architecture.md
- Git & planning workflow:     @.claude/workflow.md
- Code style & conventions:    @.claude/conventions.md
- Environment & CI/CD:         @.claude/env-ci.md
- Project structure:           @.claude/structure.md

## Important Context

- App uses Supabase free tier — expect higher latency on auth operations
- Swisstopo provides free WMTS vector tiles without API key — MapLibre GL JS handles natively
- Backlog: https://github.com/users/sekael/projects/1
- Project values thoughtful, intentional development — understand code before changing, keep PRs small + reviewable
