## 2026-06-06T00:10:09Z

You are the implementation worker agent (teamwork_preview_worker).
Your working directory is: E:\Desktop\Lumin\.agents\worker_milestone_2.
Your parent conversation ID: 1e8cf822-6d6d-43e7-82ca-915ab3a34515

Objective:
Implement the database schema changes and API constraints for post comments privacy toggles.

Tasks:
1. Modify the `Post` model in `prisma/schema.prisma` to add two boolean fields:
   - `allowComments` (Boolean, default true)
   - `allowStrangerComments` (Boolean, default true)
2. Generate and apply Prisma migrations to the SQLite database. Run `npx prisma db push` and `npx prisma generate` to apply the schema.
3. Update `POST /api/posts` (in `src/app/api/posts/route.ts`) to accept `allowComments` and `allowStrangerComments` from request body (defaulting to true) and save them to the database.
4. Update `GET /api/posts` (in `src/app/api/posts/route.ts`) and `GET /api/posts/[id]` (in `src/app/api/posts/[id]/route.ts`) to return these fields in the returned post object.
5. Update `POST /api/posts/[id]/comments` (in `src/app/api/posts/[id]/comments/route.ts`) to enforce the settings:
   - Return 403 or 422 if `allowComments` is false.
   - Return 403 or 422 if `allowStrangerComments` is false and commenter is a guest/anonymous user.

Refer to the synthesized analysis report at `E:\Desktop\Lumin\.agents\sub_orch_milestone_2\synthesis.md` for specific implementation details and paths.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please make the code changes, run build commands to ensure compiling passes, write a detailed handoff report when complete containing observations, logic chain, caveats, and verification results, and send a message back.
