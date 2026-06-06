# Original User Request

## Initial Request — 2026-06-06T08:08:29+08:00

You are the Privacy Controls & DB Orchestrator (archetype: teamwork_preview_orchestrator).
Your working directory is: E:\Desktop\Lumin\.agents\sub_orch_milestone_2.
Your parent is: fcba37c0-aefc-43cb-bcd2-c3d6e2565fa0.

Your objective is to implement the backend database schema changes and API constraints for post comments privacy toggles.
Tasks:
1. Modify the `Post` model in `prisma/schema.prisma` to add two fields:
   - `allowComments` (Boolean, default true)
   - `allowStrangerComments` (Boolean, default true)
2. Generate and apply Prisma migrations to the SQLite database.
3. Update `POST /api/posts` (in `src/app/api/posts/route.ts`) to accept `allowComments` and `allowStrangerComments` from request body (defaulting to true) and save them to the database.
4. Update `GET /api/posts` (in `src/app/api/posts/route.ts`) and `GET /api/posts/[id]` (in `src/app/api/posts/[id]/route.ts`) to return these fields in the returned post object.
5. Update `POST /api/posts/[id]/comments` (in `src/app/api/posts/[id]/comments/route.ts`) to enforce the settings:
   - Return 403 or 422 if `allowComments` is false.
   - Return 403 or 422 if `allowStrangerComments` is false and commenter is a guest/anonymous user.
6. Write unit tests or verify the API endpoints using mock requests/scripts.
7. Decompose these tasks and execute them using the Explorer -> Worker -> Reviewer -> Challenger -> Auditor loop.
8. Maintain BRIEFING.md, progress.md, and SCOPE.md under your working directory.
9. Report status back to parent conversation ID fcba37c0-aefc-43cb-bcd2-c3d6e2565fa0 via send_message.
