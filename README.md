# Baby Atlas

A baby and toddler tracker (0 to 3 years) for Norwegian parents. Norwegian Bokmål by default, metric units, 24-hour time.

Forked from [bckenstler/finnberry](https://github.com/bckenstler/finnberry) (MIT).

## Features

- **Logging (always free):** sleep, breastfeeding, bottle, solid food, diapers, pumping, growth, temperature, medicine and activities, shared across caregivers in a household.
- **One-tap shortcuts:** pin up to 4. Tap logs instantly or starts and stops a timer, press and hold opens the full form, every tap can be undone.
- **Toddler modules:** vocabulary tracker with growth over time, potty readiness signals (18 to 36 months), and the Norwegian childhood vaccine programme (Barnevaksinasjonsprogrammet) with due dates.
- **Premium:** AI insights and chat (Claude, following helsestasjon and FHI guidance), and 14-day trend statistics.
- **Mobile:** installable PWA and an iOS shell via Capacitor.

## Tech stack

Next.js 15 (App Router), React 19, tRPC 11, Prisma 6 on Supabase Postgres, NextAuth 5, Tailwind 4 with shadcn/ui, next-intl, Capacitor. pnpm and Turborepo monorepo.

## Getting started

Requirements: Node 20+, pnpm 9, a Postgres database (Supabase works).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
pnpm db:generate
pnpm --filter @baby-atlas/db exec prisma migrate deploy
pnpm --filter @baby-atlas/mcp-server build
pnpm dev
```

See `apps/web/.env.example` for all variables, including `ANTHROPIC_API_KEY` and `PREMIUM_EMAILS`.

## Checks

```bash
pnpm type-check
pnpm exec vitest run
pnpm test:e2e        # needs a running dev server and database
```

## iOS

See [apps/web/README.md](apps/web/README.md).

## Project guide

See [CLAUDE.md](CLAUDE.md) for structure, patterns, access-control rules and conventions.
