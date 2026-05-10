# TourenBuddy Frontend (Vue)

A tour-planning app for outdoor enthusiasts.
Pin tour objectives on the map, remember the friends you want to do it with, contact them, set dates, and finally complete your adventures.
TourenBuddy aims to be your one tool to keep track of objectives and touring partners outdoors.

## Disclaimer

Most of the code in this repository has been generated with Claude Code using specification-driven development based on the `openspec` framework.
You may view the configuration and settings used for code generation anytime under [CLAUDE.md](./CLAUDE.md) and [.claude](./.claude/).
The current version of the specification used in development is always available at [openspec](./openspec/specs/).

## Prerequisites

- **Node.js** 20 or later
- **npm** 10 or later
- A [Supabase](https://supabase.com) project (free tier works fine)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd tourenbuddy_frontend_vue
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project under **Settings → API**.

### Local Supabase development (recommended)

Run a full Supabase stack on your machine — DB, Auth, Storage, Studio — instead of pointing at production.

**Prerequisites:** Docker Desktop running, [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) installed.

1. Start the local stack from repo root:

   ```bash
   supabase start
   ```

   First run pulls images (~5 min). Subsequent runs are fast. Stack URL: `http://127.0.0.1:54321`. Studio: `http://127.0.0.1:54323`.

2. Get local anon key:

   ```bash
   supabase status
   ```

   Copy `anon key` from output.

3. Create `.env.local` (overrides `.env`, gitignored):

   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
   ```

4. Apply migrations to local DB:

   ```bash
   supabase db reset
   ```

   Re-runs every file under `supabase/migrations/` from clean state.

5. Run frontend:

   ```bash
   npm run dev
   ```

   App at `http://localhost:5173`, talking to local Supabase.

**Stop stack:** `supabase stop`. **View logs:** `supabase logs <service>`. **Inbox for OTP/magic-link emails:** Inbucket at `http://127.0.0.1:54324`.

### Database changes

All schema/RLS/storage changes go through migrations — never edit prod directly. See [.claude/conventions.md](./.claude/conventions.md#supabase--database).

```bash
supabase migration new <descriptive_name>     # create file
# edit supabase/migrations/<timestamp>_<name>.sql
supabase db reset                              # apply locally from scratch
npm run test                                   # verify
supabase db push                               # deploy to prod (after review)
```

### 3. Start the dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Available Commands

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Start dev server with hot reload               |
| `npm run build`      | Type-check and build for production            |
| `npm run preview`    | Preview the production build locally           |
| `npm run test`       | Run unit tests (single pass)                   |
| `npm run test:watch` | Run unit tests in watch mode                   |
| `npm run type-check` | Check TypeScript types without building        |
| `npm run lint`       | Lint all source files (zero warnings enforced) |
| `npm run format`     | Format all files with Prettier                 |

## Tech Stack

Frontend:

- **Vue 3** with TypeScript and `<script setup>` SFCs
- **Vite** — build tool and dev server
- **Pinia** — state management (composition API stores)
- **Vue Router 4** — client-side routing with auth guards
- **Supabase** — backend (PostgreSQL + Auth via email/OTP)
- **MapLibre GL JS** — map rendering
- **Swisstopo** — Swiss topographic vector tiles (free, no API key required)
- **Zod** — runtime validation and type inference
- **Vitest** — unit testing

Backend:

- Supabase PostgreSQL database with REST endpoints
- Supabase authentication and phone verification

Infrastructure:

- Cloudflare pages deployment
- Github Actions for CI/CD (including deployment to Cloudflare)
- Brevo for automated email workflows, e.g. sign-up/sign-in
- Twilio for verification of phone numbers (currently free tier, so not working correctly)

## Project Structure

```
src/
  app/
    router/        # Vue Router config and navigation guards
    theme/         # CSS custom properties, design tokens
  core/
    composables/   # Shared composables (useSnackbar, etc.)
    components/    # Shared UI components
    constants/     # Environment validation
    exceptions/    # Custom error classes
    logging/       # Logger composable wrapping consola
    utils/         # Supabase client singleton
  features/
    auth/          # Email/OTP authentication flow
    contacts/      # Contact management (tour partners)
    map/           # MapLibre map, location picker, overlays
    tours/         # Tour creation, listing, map markers
    user/          # User profile management
test/              # Unit tests mirroring src/ structure
```

## Authentication

The app uses **magic link** authentication via Supabase:

1. Enter your email address
2. Check your inbox for a magic link
3. Click on the link to authenticate
