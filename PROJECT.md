# Project: Student Anonymous Tree Hole Platform

## Architecture
This project is built using Next.js (Page/App router under `src/app`) with SQLite database via Prisma ORM (`prisma/schema.prisma`).
- **Backend APIs**:
  - Auth: `/api/auth/*`
  - Posts: `/api/posts/*`
  - Users: `/api/users/*`
  - Comments: `/api/posts/[id]/comments`
  - Notifications: `/api/notifications/*`
- **Frontend SPA**:
  - A single-page client interface implemented in `src/app/page.tsx`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Testing Track Setup | Comprehensive requirement-driven test suite | None | IN_PROGRESS (Conv ID: 5971a201-c7f2-4292-be32-1ff5a9f2eb84) |
| 2 | Privacy Controls & DB | Prisma schema update, comment status API gating | M1 (for verification) | IN_PROGRESS (Conv ID: 1e8cf822-6d6d-43e7-82ca-915ab3a34515) |
| 3 | Social & User Features | Emoji Picker, Message Box UI, My Posts view, Nickname updates | M2 | PLANNED |
| 4 | Sensory Aesthetics | Water ripple transition, Web Audio tune-up, theme notes, theme color picker | M3 | PLANNED |
| 5 | E2E Verification & Hardening | Opaque-box E2E validation, white-box adversarial testing | M4 | PLANNED |

## Interface Contracts
### Post Privacy Settings
Post model changes:
- `allowComments`: Boolean, default true
- `allowStrangerComments`: Boolean, default true

POST `/api/posts` body:
```json
{
  "content": "string",
  "categoryId": "number",
  "tags": ["string"],
  "allowComments": "boolean (optional, default true)",
  "allowStrangerComments": "boolean (optional, default true)"
}
```

GET `/api/posts` and `/api/posts/[id]` response format:
```json
{
  "post": {
    "id": 1,
    "nickname": "xxx",
    "content": "xxx",
    "allowComments": true,
    "allowStrangerComments": true,
    ...
  }
}
```

POST `/api/posts/[id]/comments` response expectations:
- Returns `403` or `422` if `allowComments` is false for the post.
- Returns `403` or `422` if commenter is guest (anonymous) and `allowStrangerComments` is false for the post.

## Code Layout
- `src/app/`: Next.js pages and API route handlers.
- `src/components/`: Shared React components.
- `src/lib/`: Backend utilities (auth, DB client, audio, etc.).
- `prisma/`: Database migrations and Prisma schema file.
