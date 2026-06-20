# Lumin — Anonymous Confession ("Tree Hole") Website

## Stack

- **Runtime** Node.js 20+ (Next.js 14 App Router, React 18)
- **Language** TypeScript 5 (strict mode)
- **Database** Prisma 7 + SQLite (local dev) / Turso (production, via `@prisma/adapter-libsql`)
- **Auth** JWT (HS256, `jose` library) stored in cookie `th_token`, 7-day expiry
- **UI** Tailwind CSS 3, `next/font` with Geist
- **Styling** PostCSS + autoprefixer + tailwindcss
- **Lint** ESLint 8, config `next/core-web-vitals` + `next/typescript`, no-unused-vars error (prefix `^_` to ignore)
- **File uploads** @aws-sdk/client-s3 (S3 presigned URLs)
- **Password hashing** bcryptjs

## Layout

| Path | What's inside |
|---|---|
| `src/app/` | Next.js App Router pages + API route handlers (`route.ts`) |
| `src/lib/` | Shared utilities: Prisma client, auth, API response helpers, rate-limit, encryption, moderation |
| `src/components/` | React client components |
| `src/data/` | Seed data JSON (categories, sensitive words, warm posts) |
| `src/scripts/` | CLI seed/maintenance scripts (excluded from tsconfig build) |
| `prisma/` | Schema (`schema.prisma`) + SQLite migrations |
| `tests/e2e/` | Jest-based end-to-end tests (CommonJS, 4 tier files) |
| `public/` | Static assets (audio, uploads) |
| `.agents/` | Agent orchestration artifacts (session logs, briefings, handoffs) |

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint via Next.js |
| `npm run pages:build` | Prisma generate + Cloudflare next-on-pages build |
| `npm run test:e2e` | Run E2E test suite (requires dev server running) |
| `npm run dev:local` | Start dev server via `dev-local.js` wrapper |

## Conventions

- **API handlers**: named exports `GET`/`POST`/`PUT`/`DELETE` in `src/app/api/**/route.ts`. Responses use `success()` / `error()` / `unauthorized()` / `forbidden()` / `notFound()` helpers from `@/lib/api-response`.
- **Prisma client**: imported as `import { prisma } from "@/lib/prisma"`. Singleton via proxy pattern; lazily initializes with `PrismaLibSql` adapter.
- **Path alias**: `@/*` maps to `./src/*` (tsconfig `paths`).
- **E2E tests**: CommonJS `.js` files under `tests/e2e/`, run via custom Node runner that shims `.ts` imports. Tests grouped by tier (1–4). Requires dev server at localhost:3000.
- **Edge runtime**: routes opt in via `export const runtime = "edge"` (currently commented out on all routes). Local SQLite is NOT supported under Edge runtime — only Turso remote DB works.
- **ESLint**: unused vars must be prefixed `_` (destructured or named).
- **Seed scripts**: in `src/scripts/`, run via `npx tsx` — excluded from the Next.js build.

## Watch out for

- **Edge + SQLite mismatch**: If a route has `runtime = "edge"`, the Prisma client throws because local SQLite needs filesystem bindings. Routes targeting Edge must use a remote Turso DB URL.
- **E2E test database**: The runner (`tests/e2e/runner.js`) hardcodes `TURSO_DATABASE_URL=file:./prisma/dev.db` — it uses the local dev DB, not a remote Turso instance.
- **Windows path casing on this machine**: The project lives at `E:\Desktop\TreeHole\treehole` (capital `D` in Desktop). Wrong casing (`E:\desktop\...`) causes webpack duplicate modules and client-side React errors.
