# Scope: Post Comments Privacy Controls and DB Schema

## Architecture
This milestone updates the backend database schema and endpoints associated with posts and post comments.
- **Database**: Prisma with SQLite (`prisma/schema.prisma` and `prisma/dev.db`).
- **REST API Routes**:
  - `POST /api/posts`: Creates a new post.
  - `GET /api/posts`: Fetches all posts.
  - `GET /api/posts/[id]`: Fetches a single post.
  - `POST /api/posts/[id]/comments`: Creates a comment on a post.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Database Schema Update | Add `allowComments` and `allowStrangerComments` to `Post` model, run migrations | None | PLANNED |
| 2 | Post Creation API | Update `POST /api/posts` to accept and save new fields | Milestone 1 | PLANNED |
| 3 | Post Retrieval APIs | Update `GET /api/posts` and `GET /api/posts/[id]` to return the new fields | Milestone 1 | PLANNED |
| 4 | Comment API Restrictions | Enforce privacy settings on comment creation (`POST /api/posts/[id]/comments`) | Milestone 1 | PLANNED |
| 5 | API Verification | Write unit/mock tests to verify endpoint constraints and logic | Milestones 2-4 | PLANNED |

## Interface Contracts
### Database Schema
- `Post` model updates:
  - `allowComments`: Boolean, default `true`
  - `allowStrangerComments`: Boolean, default `true`

### POST /api/posts
- Request Body JSON:
  - Optional `allowComments`: Boolean (defaults to `true`)
  - Optional `allowStrangerComments`: Boolean (defaults to `true`)
- Response: includes the new fields on the created `Post` object.

### GET /api/posts & GET /api/posts/[id]
- Response: each Post object includes `allowComments` and `allowStrangerComments` fields.

### POST /api/posts/[id]/comments
- Request Headers/Cookies: containing session or user authentication (to distinguish stranger/guest vs owner/authenticated commenters).
- Response:
  - Returns `403` or `422` if `allowComments` is `false`.
  - Returns `403` or `422` if `allowStrangerComments` is `false` and commenter is a guest/anonymous user.
