# Synthesis Report: Post Comments Privacy Controls and DB Schema

## Consensus
All three Explorers ([Explorer 1](E:\Desktop\Lumin\.agents\explorer_milestone_2_1\analysis.md), [Explorer 2](E:\Desktop\Lumin\.agents\explorer_milestone_2_2\analysis.md), [Explorer 3](E:\Desktop\Lumin\.agents\explorer_milestone_2_3\analysis.md)) reached a complete consensus on the required changes and execution path:

1. **Prisma Schema updates (`prisma/schema.prisma`)**:
   - Add two fields to the `Post` model:
     - `allowComments`: Boolean, defaulting to `true`
     - `allowStrangerComments`: Boolean, defaulting to `true`
   - Position these new fields among existing scalar flags (e.g., after `isHidden` or `campaign`, and before relations or `createdAt`).

2. **Database Migration**:
   - Run `npx prisma generate` followed by `npx prisma db push` (or `npx prisma migrate dev --name add_post_comment_toggles`) to apply schema changes to the local SQLite database.

3. **API - Post Creation (`src/app/api/posts/route.ts`)**:
   - In the `POST` method, destructure `allowComments` and `allowStrangerComments` from request body.
   - Set fallbacks: default to `true` if undefined or not boolean.
   - Pass the values into `prisma.post.create` data field.
   - Return fields in the response payload.

4. **API - Post Retrieval (`src/app/api/posts/route.ts` and `src/app/api/posts/[id]/route.ts`)**:
   - Explicitly include `allowComments` and `allowStrangerComments` in the mapped response object for both `GET /api/posts` (under `enrichedPosts` mapping) and `GET /api/posts/[id]` (inside the `success()` response mapping).

5. **API - Comments Restriction (`src/app/api/posts/[id]/comments/route.ts`)**:
   - Authenticated user is obtained via `const user = await getUserFromRequest();`.
   - Guest/Stranger user is defined as `user === null` (or `!user`).
   - Run checks immediately after fetching the post:
     - If `!post.allowComments`, return `error("该帖子已关闭评论功能", 403)`.
     - If `!post.allowStrangerComments && !user`, return `error("该帖子仅允许注册用户评论", 403)`.

6. **Verification Strategy**:
   - Since there is no automated unit/integration test runner configured in `package.json`, write a custom Node.js verification script (e.g., `scripts/verify-privacy-toggles.js`) that uses the native `fetch` API to request routes on a running server. It should cover post creation with toggles, comments restrictions, and retrieval validation.

## Resolved Conflicts
No conflicts were identified. All three Explorers proposed identical logic, field names, defaults, and API routes.

## Dissenting Views
None.

## Gaps
None. All aspects of the task are covered.
