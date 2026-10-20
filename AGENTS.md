# TourenBuddy Frontend Agent Guide

Canonical project context for all coding agents. Claude Code loads it through `CLAUDE.md`
(`@AGENTS.md`); `@path` lines below are Claude Code imports — other agents read those files directly.

## Project

TourenBuddy is a Vue 3 + TypeScript tour-planning app. Users pin tour objectives on a Swiss
topo map (Swisstopo), link contacts, and pick planned dates.

## Stack

- **Framework:** Vue 3 + TypeScript, `<script setup>` SFCs
- **Build:** Vite 6, deployed to Cloudflare Pages; PWA via `vite-plugin-pwa` (custom `src/sw.ts`), IndexedDB offline cache + write queue, Web Push
- **State:** Pinia 3 composition stores (`defineStore` setup syntax)
- **Routing:** Vue Router 4, manual route definitions in `src/app/router/index.ts`
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth via email OTP) — use `@supabase/supabase-js` directly, no Axios
- **Worker:** Cloudflare Worker `services/email-hook` (Auth email hook, notification delivery, calendar sync) — deployed manually
- **Map:** MapLibre GL JS with Swisstopo vector/WMTS tiles (free, no API key)
- **Design system:** Inter self-hosted via `@fontsource/inter` (400/500/600); icons are bundled tree-shaken **SVGs** (`unplugin-icons` + Iconify `material-symbols`) via a central registry (`src/core/components/icons.ts`) behind `<BaseIcon>`. **No Google Fonts CDN, no icon font** — do NOT reintroduce either. See `.claude/conventions.md` → Fonts & icons for how to add an icon or font weight.
- **Testing:** Vitest + happy-dom for unit/component tests; pgTAP suites in `supabase/tests`; Playwright installed, no E2E config yet
- **Linting:** ESLint `@antfu/eslint-config` (strict) + Prettier (no semicolons, single quotes, 100 char width)
- **Logging:** `useLogger` composable wrapping `consola` — no `console.log()`
- **Validation:** Zod for runtime validation + type inference
- **i18n:** `vue-i18n`
- **Phone:** `libphonenumber-js` for parsing/formatting (default region CH)

## Must Follow

- IMPORTANT: For any new feature or non-trivial change, apply spec-driven development with OpenSpec:
  - **Default:** `openspec-propose` — propose the change with all artifacts in one step
  - Wait for explicit user approval before implementing with `openspec-apply`
  - Prompt the user to archive the completed change with `openspec-archive`
- A simple task touching >3 files still gets a brief plan.
- Before a new feature/task, branch from latest `main`. Never commit to `main`.
- Never run `git commit`; prompt the user with a ready-to-copy conventional commit message (`type(scope): description`).
- IMPORTANT: ALL DB changes (schema/RLS/functions/storage) go through NEW migrations in `supabase/migrations/`, applied to the LOCAL DB first, pushed to prod only after verification. Never edit an existing migration. See `.claude/conventions.md` → Supabase / Database.
- New DB functions need an explicit `grant execute` (no implicit grants); views must be `security_invoker`. See `docs/supabase-rpc-authorization.md`.
- Do not edit `CHANGELOG.md` or the package version manually (release-please).
- User-facing text must use `vue-i18n` and all locale files.
- No `console.log()`; use `useLogger`.
- Run `npx eslint . --fix` after code changes (never `npm run format`) and `npm run test` after implementation.

## Commands

```bash
npm run dev          # dev server
npm run dev:phone    # HTTPS on the LAN + Supabase proxy, for phone testing (README → Setup 5)
npm run test         # all tests
npm run type-check
npx eslint . --fix   # after changes
npx eslint           # zero warnings — enforced in CI
```

## Detailed Docs

- Architecture: @.claude/architecture.md
- Workflow: @.claude/workflow.md
- Conventions: @.claude/conventions.md
- Environment & CI: @.claude/env-ci.md
- Structure: @.claude/structure.md
- Testing: @.claude/testing.md

## Important Context

- Supabase free tier — expect higher auth latency
- PWA caches assets + map tiles, plus an offline data cache with queued write sync (change: offline-write-sync)
- Notifications are recorded by the DB (`public.notifications` = inbox) in the writing transaction and delivered by the Worker — never dispatched from the client. See `docs/notifications.md`
- Backlog: https://github.com/users/sekael/projects/1
- Values: thoughtful development, understand before changing, small reviewable PRs
