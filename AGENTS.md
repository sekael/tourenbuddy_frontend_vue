# TourenBuddy Frontend Agent Guide

Canonical project context for agents that auto-load `AGENTS.md`.
Claude Code stays supported via `CLAUDE.md`, which points here.

## Project

TourenBuddy is a Vue 3 + TypeScript tour-planning app. Users pin tour objectives
on a Swiss topo map, link contacts, and pick planned dates.

## Stack

- Vue 3, TypeScript, Vite 6, Pinia 3, Vue Router 4
- Supabase PostgreSQL/PostgREST/Auth via email OTP
- MapLibre GL JS with Swisstopo vector/WMTS tiles
- Vitest + happy-dom; Playwright installed, no E2E config yet
- ESLint `@antfu/eslint-config` + Prettier
- Zod, `vue-i18n`, `consola`, `libphonenumber-js`

## Must Follow

- For new features or non-trivial changes, use spec-driven OpenSpec workflow first.
- Before new feature/task, branch from latest `main`.
- Never commit unless user explicitly asks. Never commit to `main`.
- Do not edit existing Supabase migrations; add new migrations only.
- Do not edit `CHANGELOG.md` or package versions manually.
- User-facing text must use `vue-i18n` and all locale files.
- No `console.log()`; use `useLogger`.
- Run `npx eslint . --fix` after code changes and `npm run test` after implementation.

## Commands

```bash
npm run dev
npm run test
npm run type-check
npx eslint . --fix
npx eslint
```

## Detailed Docs

- Architecture: `.claude/architecture.md`
- Workflow: `.claude/workflow.md`
- Conventions: `.claude/conventions.md`
- Environment and CI: `.claude/env-ci.md`
- Structure: `.claude/structure.md`
- Testing: `.claude/testing.md`
- Backlog: https://github.com/users/sekael/projects/1
