# Baby Atlas - Claude Context

This file provides context for Claude when working on this codebase.

## Project Overview

Baby Atlas is a baby and toddler tracker (0 to 3 years) for Norwegian parents. It is a fork of [bckenstler/finnberry](https://github.com/bckenstler/finnberry) (git remote `upstream`). It tracks sleep, feeding, diapers, pumping, growth, temperature, activities and medicine, plus toddler modules: vocabulary, potty readiness and the Norwegian vaccine programme.

### Baby Atlas rules

- **Language:** Norwegian Bokmål (`nb`) is the default, English (`en`) is secondary. next-intl without locale URLs; the locale comes from the `NEXT_LOCALE` cookie (`apps/web/src/i18n/`). Messages live in `apps/web/messages/{nb,en}/<namespace>.json` and are registered in each `index.ts`. English is typed against Bokmål, so a missing key fails type-check. No hard-coded UI strings.
- **Units:** metric only (ml, kg/g, cm, °C) and 24-hour time. Time zone Europe/Oslo.
- **Access control:** every tRPC procedure must check household membership. Use `householdProcedure` for inputs with `childId`/`householdId`/child or household `id` (it fails closed and requires all id fields to agree), `recordProcedure(model)` for inputs addressed by a record id, or `assertChildAccess(ctx, childId, { write })` inside a `protectedProcedure`. AI tool calls go through `scopeToolCall` (`apps/web/src/lib/agent/`).
- **Premium:** logging is always free. AI chat, AI insights (`/api/ai/insights`) and trend statistics (`trpc.stats`) require premium: `User.isPremium` or an email in `PREMIUM_EMAILS`. The weekly digest and visit report (`trpc.digest`) are free with basic averages; trend charts, daily series and AI stay premium. See `apps/web/src/lib/subscription.ts` and `packages/api/src/premium.ts`.
- **Quick actions:** one tap logs or toggles a timer, long press opens the detail form, every tap offers undo. Users pin up to 4 (`User.quickActions`). See `apps/web/src/hooks/use-quick-actions.ts`.
- **Migrations:** `packages/db/prisma/migrations/` (baseline plus RLS on every table). Use `prisma migrate dev` for schema changes; new tables need `ENABLE ROW LEVEL SECURITY` in their migration.
- **iOS:** Capacitor shell that loads the hosted app (`apps/web/capacitor.config.ts`, `apps/web/ios/`). See `apps/web/README.md`.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Language**: TypeScript (strict mode)
- **API**: tRPC v11 with SuperJSON transformer
- **Database**: PostgreSQL (Neon in production, Docker Postgres locally)
- **Hosting**: Vercel, with private Vercel Blob for journal photos (see "Production" below)
- **ORM**: Prisma 6
- **Auth**: NextAuth.js v5 (email magic link + Google OAuth)
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **State**: Zustand with localStorage persistence
- **Real-time**: Supabase Realtime WebSocket subscriptions
- **MCP**: @modelcontextprotocol/sdk for AI agent integration
- **Monorepo**: Turborepo with pnpm workspaces

## Project Structure

```
baby-atlas/
├── apps/
│   ├── web/                     # Next.js webapp
│   │   ├── src/
│   │   │   ├── app/             # App Router pages
│   │   │   │   ├── (auth)/      # Auth pages (login, verify)
│   │   │   │   ├── (dashboard)/ # Protected dashboard routes
│   │   │   │   └── api/         # API routes (tRPC, NextAuth, chat, test/seed)
│   │   │   ├── components/
│   │   │   │   ├── ui/          # shadcn/ui components
│   │   │   │   ├── tracking/    # Sleep, feeding, diaper, timer components
│   │   │   │   ├── reports/     # Day/week/list views, activity rows, timeline
│   │   │   │   ├── chat/        # AI chat interface components
│   │   │   │   └── dashboard/   # Dashboard layout, child selector
│   │   │   ├── hooks/           # React hooks (use-timer, use-toast, use-realtime, use-chat)
│   │   │   ├── lib/             # Config (auth, trpc, supabase, utils)
│   │   │   └── stores/          # Zustand stores (timer-store)
│   │   └── package.json
│   │
│   └── mcp-server/              # MCP Server for AI integration
│       └── src/
│           ├── index.ts         # Server entry point (stdio transport)
│           ├── tools/           # MCP tools (sleep, feeding, diaper, etc.)
│           ├── resources/       # MCP resources (children, activity data)
│           └── prompts/         # MCP prompts (analyze-sleep, daily-summary)
│
├── packages/
│   ├── db/                      # Prisma schema + client
│   │   ├── prisma/schema.prisma # Database schema (17 models)
│   │   └── src/index.ts         # Prisma client singleton
│   │
│   ├── api/                     # tRPC routers
│   │   └── src/
│   │       ├── trpc.ts          # tRPC context, procedures, middleware
│   │       ├── root.ts          # Root router combining all routers
│   │       └── routers/         # Individual routers (12 total)
│   │
│   ├── schemas/                 # Shared Zod validation schemas
│   │   └── src/                 # One file per domain (sleep, feeding, etc.)
│   │
│   └── utils/                   # Shared utilities
│       └── src/
│           ├── date.ts          # Date formatting, ranges, duration calc
│           ├── format.ts        # ML, oz, weight, height, temperature formatters
│           └── timeline.ts      # Timeline data utilities
│
└── Configuration files
```

## Common Commands

```bash
# Development
pnpm dev                    # Start all apps in development mode
pnpm build                  # Build all packages and apps
pnpm lint                   # Run ESLint across all packages
pnpm type-check             # Run TypeScript checks

# Fresh worktree/clone setup
# The web app imports from @baby-atlas/mcp-server/tools which requires the dist folder.
# On a fresh clone or worktree, build the MCP server first:
pnpm --filter @baby-atlas/mcp-server build

# Local database (Docker). Point DATABASE_URL and DIRECT_URL in apps/web/.env.local at
# postgresql://postgres:pg@localhost:55432/postgres, then run prisma migrate deploy
docker run -d --name ba-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16
# Local sign-in without email: set DEV_LOGIN_EMAIL, open /api/dev/login (?as=other@x for a second user)

# Database
pnpm db:generate            # Generate Prisma client
pnpm db:push                # Push schema to database (no migration)
pnpm db:migrate             # Run database migrations
pnpm --filter @baby-atlas/db db:studio  # Open Prisma Studio

# Individual apps
pnpm --filter @baby-atlas/web dev       # Run only web app
pnpm --filter @baby-atlas/mcp-server build  # Build MCP server

# Testing
pnpm test                   # Run all tests (Vitest)
pnpm test:unit              # Run utils + schemas tests only
pnpm test:integration       # Run API integration tests only
pnpm test:components        # Run web component tests only
pnpm test:e2e               # Run Playwright E2E tests (requires dev server)
pnpm test:coverage          # Run tests with coverage report
```

## Testing

### Test Coverage

| Suite | Framework | Tests | Description |
|-------|-----------|-------|-------------|
| Unit | Vitest | ~240 | Utils + Schemas validation |
| Integration | Vitest | ~120 | tRPC routers with mocked Prisma |
| E2E | Playwright | 25 | Full browser tests with real DB |

### Test Structure

```
baby-atlas/
├── packages/
│   ├── utils/src/*.test.ts        # Unit tests for utilities
│   ├── schemas/src/*.test.ts      # Schema validation tests (11 files)
│   └── api/src/
│       ├── test/                   # Test setup and helpers
│       │   ├── setup.ts            # Prisma mock setup
│       │   └── helpers.ts          # Test context creators, factories
│       ├── trpc.test.ts            # Middleware tests
│       └── routers/*.test.ts       # Router integration tests (9 routers)
└── apps/web/
    ├── src/stores/*.test.ts        # Zustand store tests
    └── e2e/                         # Playwright E2E tests
        ├── fixtures/
        │   ├── auth.ts              # Authenticated page/context fixtures
        │   └── database.ts          # Test data seeding via API
        ├── auth.spec.ts             # Login, magic link, error pages
        ├── household.spec.ts        # Dashboard, child navigation
        ├── tracking.spec.ts         # Sleep, feeding, diaper tracking
        ├── timer-persistence.spec.ts # Timer survives refresh
        └── realtime-sync.spec.ts    # Optimistic updates
```

### Writing API Tests

API tests use mocked Prisma. Import helpers from `test/helpers.ts`:

```typescript
import { prismaMock } from "../test/setup";
import { createTestContext, createTestMembership, TEST_IDS } from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { myRouter } from "./my-router";

const createCaller = createCallerFactory(myRouter);

it("does something", async () => {
  const ctx = createTestContext();
  const caller = createCaller(ctx);

  // Setup mocks
  prismaMock.householdMember.findUnique.mockResolvedValue(
    createTestMembership({ role: "OWNER" }) as never
  );

  // Call procedure
  const result = await caller.myProcedure({ ... });

  // Assert
  expect(result).toBeDefined();
});
```

### Test IDs

Use valid CUID format IDs from `TEST_IDS` constant:
```typescript
import { TEST_IDS } from "../test/helpers";
// TEST_IDS.userId, TEST_IDS.householdId, TEST_IDS.childId, etc.
```

### E2E Test Infrastructure

E2E tests use a test seed API (`/api/test/seed`) to create real database records:
- Only available in development/test environments
- Creates test users, sessions, households, and children
- Cleanup removes all records prefixed with `e2e-test`

Tests run serially (`workers=1`) to avoid race conditions. Run with:
```bash
# Requires dev server running on port 3001
BASE_URL=http://localhost:3001 pnpm test:e2e
```

## Key Patterns

### tRPC Procedures

Three procedure types in `packages/api/src/trpc.ts`:
- `publicProcedure` - No auth required
- `protectedProcedure` - Requires authenticated session
- `householdProcedure` - Requires auth + validates household/child access

### Timer System

Timers persist in localStorage via Zustand (`apps/web/src/stores/timer-store.ts`):
- Start timer → store in Zustand + create DB record
- Stop timer → remove from Zustand + update DB record with endTime
- Page refresh → timers restored from localStorage
- Breastfeeding timers support per-side duration tracking (leftDurationSeconds, rightDurationSeconds)
- Side switching during active breastfeeding timer
- When activities are started via Chat/MCP (database only), the UI syncs on modal open via `getActive` queries

### Offline and install

- Quick actions never call tRPC directly. They pick the record id on the device (`createRecordId`, cuid shape) and queue the write in the outbox (`apps/web/src/lib/offline/outbox.ts`, persisted in localStorage with superjson). `OutboxSync` sends it in order: right away, on `online`, on return to the foreground, and with backoff. Network errors, 401 and 5xx retry (5xx gives up after `MAX_SERVER_FAILURES`). CONFLICT on a stop and NOT_FOUND on a delete count as done. Other errors drop the record's entries and show a toast. Each entry carries the user id and is sent only once the server has confirmed that user in this app session (`useDeviceOwner().verified`). Sent entries stay as `synced` until the refetch lands, so the overlay does not flicker.
- Create procedures take an optional `recordId` (not `id`: `householdProcedure` reads `id` as a child or household id). `findReplayedRecord` (`packages/api/src/replay.ts`) returns the stored record when a create is sent again.
- Undo before sync removes the queued create. Otherwise it queues a delete.
- `useLastActivities` overlays queued writes on `timeline.getLastActivities` (`applyPending`), so the home screen and quick-action state are right before sync. Timelines show offline entries after sync.
- Whose saved data loads is decided in `OfflineData` (`components/offline/offline-data.tsx`, `lib/offline/device-owner.ts`). It calls `user.get` directly, never from the cache. Online, nothing is restored until the server answers. If the answer is a different user than last time, all saved queries and cached pages are deleted first (`claimDevice`). UNAUTHORIZED deletes them too (`releaseDevice`), and this also runs on the login page. Offline, or after 3 seconds without an answer, the last confirmed user's data loads, but nothing is sent.
- The React Query cache is saved to IndexedDB per user (`baby-atlas-query-cache:<userId>`) for 7 days (`lib/offline/query-persister.ts`) and restored in the background with `persistQueryClient`. Do not switch to `PersistQueryClientProvider`: it holds queries idle while restoring, so `isLoading` is false with no data and pages flash their empty states. Sign-out goes through `useSignOut`, which signs out first (it fails with a toast offline), then clears that cache and the service worker page cache but keeps the outbox.
- `public/sw.js` (production only): `/_next/static` cache first, pages network first with a 4 second timeout, `/api` never cached. Bump `VERSION` to drop old caches.
- Mutations default to `networkMode: "always"`, so detail forms fail with an error offline instead of waiting.
- iOS has no install prompt. `InstallHint` (dashboard layout) shows the Share steps in iOS browsers, or "Open in Safari" in in-app browsers where iOS hides "Add to Home Screen". Dismissal is stored in localStorage.
- The Capacitor shell has no service worker unless App-Bound Domains are set up. The outbox and saved cache still work there.

### AI Chat Interface

The chat page and the dashboard Chat tab both render `Chat` (`apps/web/src/components/chat/chat.tsx`), built on assistant-ui (`@assistant-ui/react`, `LocalRuntime`):
- `/api/chat` streams SSE events (`lib/chat/stream-events.ts`) from the Anthropic SDK, with tool calling scoped by `scopeToolCall`
- `lib/chat/chat-model-adapter.ts` is the `ChatModelAdapter` that calls the route
- Images: the client downscales to 1600 px JPEG (`lib/chat/downscale-image.ts`); the route validates with zod (`lib/chat/schema.ts`): jpeg/png/webp/gif, max 4 per message, max 5 MB decoded
- History is trimmed to 20 messages and images older than the last 2 user turns become a placeholder (`lib/chat/conversation.ts`), on both client and server
- UI components live in `components/assistant-ui/` (thread, composer, attachment, markdown, tool call row, model picker)

### Journal

A shared journal per child (`/dashboard/[childId]/journal`): text, up to 6 photos, a date that can be back-dated, and one or more tags (`JournalTag`). Everyone in the household reads it. Owners and admins edit and delete every entry, caregivers only their own, viewers none (`canEditJournalEntry` in `@baby-atlas/utils`).
- tRPC `journal` router (`packages/api/src/routers/journal.ts`): `list` (cursor pagination, `tags` filter matches any selected tag, never returns storage keys), `create`, `update`, `delete`, `deletePhoto`, `reorderPhotos`. `journalEntry` and `journalPhoto` are in `recordProcedure`'s resolvers. Deleting removes the stored files through `ctx.storage` (a failure is logged, not thrown).
- Photos are private family data and never have public URLs. Upload: `POST /api/journal/photos` (multipart `entryId` + `file`, one photo per request). It needs a session and edit rights on the entry, checks magic bytes (jpeg, png, webp, heic/heif), allows at most 6 photos per entry, then `sharp` auto-rotates, strips all metadata including GPS, resizes to 2048 px and writes WebP plus a 400 px thumbnail. Serve: `GET /api/journal/photos/[photoId]?size=thumb|full` checks household membership and answers 404 (not 403) for anything the user may not see.
- sharp's prebuilt libvips reads AVIF but not HEVC, so a raw HEIC upload answers 415 `heic_unsupported`. The client converts through a canvas first (`downscaleImage` in `lib/chat/downscale-image.ts`, shared with chat), which works where the browser can decode HEIC (Safari and iOS).
- Storage (`apps/web/src/lib/storage/`): `put(key, bytes, mimeType)`, `get(key)` returning a stream plus mimeType, `delete(key)`. Keys are `journal/{childId}/{entryId}/{photoId}.webp` and `...{photoId}.thumb.webp`. `STORAGE_DRIVER=local` (default in development) writes to `apps/web/.uploads/` (git-ignored, `STORAGE_LOCAL_DIR` overrides). `STORAGE_DRIVER=vercel-blob` uses a private Vercel Blob store through `BLOB_READ_WRITE_TOKEN` (production uses this). `STORAGE_DRIVER=supabase` uses the private bucket `journal` through `SUPABASE_SERVICE_ROLE_KEY`. Both are server side only. Vercel limits a request body to 4.5 MB, so the client downscales before upload.
- UI in `components/journal/`; tag colours in `lib/journal-tags.ts`.

### Push notifications

Web Push (VAPID, `web-push`), personal per user. Settings UI: "Varsler" card on the profile settings page (`components/notifications/notification-settings.tsx`, `hooks/use-push-subscription.ts`). tRPC `notifications` router stores settings and subscriptions; `POST /api/notifications/test` sends a test push (web-push lives in `apps/web`, not the API package).
- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`), `CRON_SECRET`. Generate keys with `npx web-push generate-vapid-keys`. Missing keys disable push (UI says so, cron answers 503). `apps/web/.env.example` could not be updated by the agent (access denied), add these four there.
- `GET /api/cron/notifications` (bearer `CRON_SECRET`, constant-time compare) runs `runDispatcher` (`lib/notifications/`): evaluators (`evaluators/<kind>.ts`, one per `NotificationKind`, registered in `evaluators/index.ts`) return `Candidate`s; `plan.ts` filters per recipient (enabled kind, muted child, quiet hours in Europe/Oslo, already logged); the dispatcher inserts the `NotificationLog` row first and sends only if the insert won, so concurrent runs never double-send. A notice held back by quiet hours is not logged, so it is re-evaluated next run. Subscriptions: 404/410 are deleted at once; 400/403/413 count and delete after 5; 5xx, 429 and network errors never count and delete only after 7 days without a success. Endpoints must be https on a known push service (`isAllowedPushEndpoint`), at most 10 per user, sends time out after 10 s and run 10 at a time. Sign-out and a device owner change remove the browser subscription; `pushsubscriptionchange` in `sw.js` re-registers through `POST /api/notifications/resubscribe`. Logs older than 60 days are pruned.
- Call the endpoint every 5 minutes from cron-job.org; `apps/web/vercel.json` has a daily Vercel cron as a backstop (Hobby allows daily only).
- Push texts live in `messages/{nb,en}/notifications.json` under `push.*` and are translated server-side in the recipient's `NotificationSettings.locale` (`translate.ts`). Keep `Candidate.titleKey/bodyKey` relative to the `notifications` namespace.
- `public/sw.js` handles `push` and `notificationclick` (only same-origin paths are opened). The worker is production only; set `NEXT_PUBLIC_SW_IN_DEV=1` to test push locally. iOS needs the app on the Home Screen (16.4+).

### Timeline Views

Reports section has three views, all showing all 8 activity types:
- **Day View** (`day-view.tsx` + `timeline/track.tsx`) - Vertical timeline with clickable event blocks
- **Week View** (`week-view.tsx`) - 7-column grid with activity markers
- **List View** (`list-view.tsx`) - Chronological list grouped by date

The `timeline.ts` router fetches all record types (sleep, feeding, diaper, pumping, medicine, growth, temperature, activity) for each view. Cache invalidation in `activity-row.tsx` ensures all views update after edits/deletes.

### Real-time Sync

Supabase Realtime in `apps/web/src/hooks/use-realtime.ts`:
- Subscribe to postgres_changes on record tables
- Filter by child_id
- Invalidate tRPC queries on changes

### MCP Server

The MCP server (`apps/mcp-server/`) provides:
- **Tools**: Actions like `start-sleep`, `log-feeding`, `log-diaper`
- **Resources**: Read-only data like `babyatlas://children/{id}/today`
- **Prompts**: AI analysis prompts like `analyze-sleep-patterns`

## Database Schema

Key models in `packages/db/prisma/schema.prisma`:
- `User`, `Account`, `Session` - NextAuth.js models
- `Household`, `HouseholdMember`, `HouseholdInvite` - Multi-caregiver
- `Child` - Child profiles
- `SleepRecord`, `FeedingRecord`, `DiaperRecord` - Core tracking
- `PumpingRecord`, `GrowthRecord`, `ActivityRecord`, `TemperatureRecord` - Extended tracking
- `Medicine`, `MedicineRecord` - Medicine tracking

## Git Workflow

**CRITICAL: Never commit directly to main. All work must happen on feature/fix branches.**

### Before Starting Any Work

1. Check current branch: `git branch --show-current`
2. If on `main`, create and switch to a new branch BEFORE making any changes:
   ```bash
   # For bug fixes
   git checkout -b fix/descriptive-name

   # For new features
   git checkout -b feature/descriptive-name

   # For refactoring
   git checkout -b refactor/descriptive-name

   # For documentation
   git checkout -b docs/descriptive-name
   ```

### After Completing Work

```bash
git push -u origin <branch-name>
gh pr create --fill
# Then merge via GitHub PR
```

### Branch Naming Conventions

- `fix/` - Bug fixes (e.g., `fix/timer-stop-bug`)
- `feature/` - New features (e.g., `feature/chat-interface`)
- `refactor/` - Code refactoring (e.g., `refactor/timeline-queries`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)

### Enforcement

If a user requests changes while on `main`:
1. **Do not make any code changes yet**
2. Create an appropriately named branch based on the request
3. Switch to that branch
4. Then proceed with the requested changes
5. Commit and push to the new branch
6. Create a PR for review

## Conventions

### File Naming
- React components: PascalCase (`QuickLogGrid.tsx`)
- Utilities/hooks: kebab-case (`use-timer.ts`)
- Routes: lowercase with brackets for params (`[childId]/page.tsx`)

### Imports
- Use `@/` alias for web app internal imports
- Use `@baby-atlas/` for monorepo package imports

### Component Structure
- UI components in `components/ui/` (shadcn/ui style)
- Feature components co-located with routes or in `components/`
- Server components by default, `"use client"` only when needed

### API Patterns
- All mutations invalidate relevant queries
- Use optimistic updates for timer actions
- Toast notifications for user feedback

## Environment Variables

Create `.env` in `apps/web/` (see `apps/web/.env.example`):
```
DATABASE_URL=            # Supabase PostgreSQL pooler connection
DIRECT_URL=              # Direct connection (for migrations)
AUTH_SECRET=             # Generate with: openssl rand -base64 32

# Optional
NEXTAUTH_URL=            # http://localhost:3000 for dev (auto-detected if not set)
GOOGLE_CLIENT_ID=        # For Google OAuth
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # Server-side Supabase access (also the journal photo bucket)
STORAGE_DRIVER=          # "local" (default in dev, apps/web/.uploads), "vercel-blob" or "supabase"
BLOB_READ_WRITE_TOKEN=   # For STORAGE_DRIVER=vercel-blob
STORAGE_LOCAL_DIR=       # Optional: replaces apps/web/.uploads for the local driver
EMAIL_SERVER=            # SMTP connection string for magic links
EMAIL_FROM=              # Sender email address
ANTHROPIC_API_KEY=       # For AI Chat feature (sk-ant-...)
```

## Testing the MCP Server

1. Build: `pnpm --filter @baby-atlas/mcp-server build`
2. Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "baby-atlas": {
      "command": "node",
      "args": ["/path/to/baby-atlas/apps/mcp-server/dist/index.js"],
      "env": { "DATABASE_URL": "..." }
    }
  }
}
```
3. Test tools: `list-children`, `get-daily-summary`, `log-diaper`, etc.

## Deploying to Vercel

### Setup

1. Import your repository in the Vercel dashboard
2. Set **Root Directory** to `apps/web`. `apps/web/vercel.json` builds through Turborepo from the repo root (so Prisma generates and the MCP server builds first) and pins functions to `fra1`.
3. Connect Neon (Postgres, Frankfurt) and a private Blob store from the Storage tab. They inject `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `BLOB_READ_WRITE_TOKEN`.
4. Configure the other environment variables (see below). New env vars a build needs must also be listed in `turbo.json` (`env` or `passThroughEnv`), because Turborepo hides undeclared variables on Vercel.
5. Run migrations from your machine: `DATABASE_URL=<unpooled> DIRECT_URL=<unpooled> pnpm --filter @baby-atlas/db exec prisma migrate deploy`
6. Deploy

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Pooled Postgres connection (set by the Neon integration) |
| `DIRECT_URL` | Direct connection, the same value as `DATABASE_URL_UNPOOLED` |
| `AUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `AUTH_URL` | Your production URL. Auth.js trusts the host on Vercel without it, but set it for a fixed domain |
| `STORAGE_DRIVER` | `vercel-blob` (needs `BLOB_READ_WRITE_TOKEN`) or `supabase`. The local driver has no writable disk on Vercel |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (for realtime) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (for realtime) |
| `EMAIL_SERVER` | SMTP connection string for magic links |
| `EMAIL_FROM` | Sender email address |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI chat and insights |
| `PREMIUM_EMAILS` | Comma-separated emails treated as premium (until payments exist) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key (`npx web-push generate-vapid-keys`). Without the VAPID keys push is off |
| `VAPID_PRIVATE_KEY` | Web Push private key. Server only |
| `VAPID_SUBJECT` | `mailto:` address or https URL identifying the sender to push services |
| `CRON_SECRET` | Bearer secret for `/api/cron/notifications` (Vercel Cron and cron-job.org send it) |
| `CAP_SERVER_URL` | URL the iOS shell loads (Capacitor) |
| `BLOB_READ_WRITE_TOKEN` | Needed when `STORAGE_DRIVER=vercel-blob`. Set by Vercel. Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Needed when `STORAGE_DRIVER=supabase`. Server only |

### API Timeout Configuration

The AI chat route sets `maxDuration = 60` (`apps/web/src/app/api/chat/route.ts`). The project runs on Fluid compute, where Hobby allows up to 300 seconds, so 60 works on every plan.

### Production (current setup)

- URL: https://baby-atlas.vercel.app. Vercel project `baby-atlas` in team `jeylohs-projects` (Hobby plan, which is for non-commercial use: move to Pro before taking payments).
- Deploys: Vercel's GitHub integration builds every push to `main` as production and other branches as previews. `gh` on this machine is logged in with a work (Enterprise Managed) account that cannot open PRs on `Jeyloh/baby-atlas`, so changes go to `main` with `git push` (SSH remote `github-personal`).
- Database: Neon `baby-atlas-db` (free plan, `fra1`), connected through the Vercel Marketplace. Blob: private store `baby-atlas-photos` (`fra1`). Functions run in `fra1` (`apps/web/vercel.json`).
- Env vars set in production and preview: the Neon and Blob ones injected by Vercel, plus `DIRECT_URL`, `AUTH_SECRET`, `STORAGE_DRIVER=vercel-blob`, `PREMIUM_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Not set yet: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET` (push notifications and the dispatcher cron stay off or answer 401/503 until they are), `ANTHROPIC_API_KEY` (AI chat and insights fail without it), `EMAIL_SERVER`/`EMAIL_FROM` (magic links), `AUTH_URL` (not needed on `*.vercel.app`).
- Google OAuth: Google Cloud project `baby-atlas-511310`, web client "Baby Atlas Oauth", redirect URI `https://baby-atlas.vercel.app/api/auth/callback/google`. The consent screen is in testing mode, so only listed test users can sign in until it is published. A custom domain needs a new redirect URI there.
- Migrations: run from your machine against the unpooled URL. `vercel env pull` (from the repo root, linked through `.vercel/`) writes the values to `.env.local`, then run `DATABASE_URL=$DATABASE_URL_UNPOOLED DIRECT_URL=$DATABASE_URL_UNPOOLED pnpm --filter @baby-atlas/db exec prisma migrate deploy`. Vercel builds never migrate.
- Logs: `npx vercel logs baby-atlas.vercel.app --since 15m --level error`.

### Deploy gotchas

- `apps/web` must list `@prisma/client` as its own dependency. Without it pnpm hides the package from Next, which then bundles Prisma instead of keeping it external, and the query engine file is never traced into the functions ("Prisma Client could not locate the Query Engine for runtime rhel-openssl-3.0.x"). Check a build with `rg -l libquery_engine apps/web/.next/server --glob '*.nft.json'` (must find files).
- Never set `trustHost: false` in `auth.ts`. Auth.js only fills in its default when the option is unset, and `false` rejects every request in production (shows "Det er et problem med serverkonfigurasjonen").
- Turborepo strict env mode hides undeclared variables during the Vercel build. New build-time env vars go in `turbo.json` (`env` for `NEXT_PUBLIC_*`, `passThroughEnv` for the rest).
- The Vercel CLI edits the repo when it links or installs integrations: it appends `.env*` to `.gitignore` (which would ignore `.env.example`) and writes agent skill files (`.agents/`, `.claude/skills/`, `skills-lock.json`). Do not commit these.
- Supabase Realtime is not configured in production (`NEXT_PUBLIC_SUPABASE_*` unset). The main screens poll instead.

## Known Limitations / TODOs

- No privacy policy or GDPR text yet. The app stores children's health data, so write these before inviting other families.
- No photo upload for children yet
- Growth charts with percentiles not implemented
- No data export (CSV/JSON) UI yet
- Email sending for magic links needs SMTP config
- No payments yet: premium is set by `User.isPremium` or `PREMIUM_EMAILS`. RevenueCat (iOS) or Stripe (web) should set `isPremium` via webhook.
- Supabase Realtime `postgres_changes` (`use-realtime.ts`, only on the legacy sleep/feeding/diapers pages) stops working once RLS is on. Switch to Realtime Broadcast from the server if live sync is needed.
- The MCP server (`apps/mcp-server`) trusts its arguments and is for single-user local use only. The web chat scopes calls via `scopeToolCall`.
