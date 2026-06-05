# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumin — an anonymous confession ("tree hole") website built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma 7 + SQLite.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Sync schema to SQLite database
npx prisma studio    # Open Prisma Studio (DB browser)
```

## Architecture

- **App Router** (`src/app/`): All pages and layouts use Next.js App Router. `layout.tsx` is the root layout, `page.tsx` is the home page.
- **Prisma + SQLite**: Schema at `prisma/schema.prisma`. The Prisma client is generated to `src/generated/prisma/` (gitignored). Use `src/lib/prisma.ts` to import the client singleton — it uses the `@prisma/adapter-better-sqlite3` adapter and caches the instance in `globalThis` to avoid creating multiple clients in dev.
- **Path alias**: `@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Windows Path Casing

The project lives at `E:\Desktop\TreeHole\treehole` (capital `D` in Desktop). Always use this exact casing when `cd`-ing into the project. Using `E:\desktop\...` (lowercase) causes webpack to create duplicate modules, which breaks client-side React and produces "Application error: a client-side exception" in the browser.

## Key Files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema — add models here |
| `prisma.config.ts` | Prisma config (reads `DATABASE_URL` from `.env`) |
| `src/lib/prisma.ts` | Prisma client singleton — import `prisma` from here |
| `src/app/layout.tsx` | Root layout (HTML shell, metadata) |
| `src/app/page.tsx` | Home page |
| `src/app/globals.css` | Tailwind directives + global styles |
