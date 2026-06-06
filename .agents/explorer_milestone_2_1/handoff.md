# Handoff Report - Post Comments Privacy Controls

## 1. Observation
- **Prisma Schema (`prisma/schema.prisma`)**:
  - The `Post` model is defined at lines 53-81.
- **Post API Route (`src/app/api/posts/route.ts`)**:
  - `GET` method processes pagination and returns mapped enriched posts at lines 97-110.
  - `POST` method extracts request parameters at line 165: `const { content, imageUrl, tags, categoryId } = body;` and creates the post record via `prisma.post.create` at lines 222-238.
- **Single Post API Route (`src/app/api/posts/[id]/route.ts`)**:
  - `GET` method fetches the post and returns it in a mapped response at lines 79-93.
- **Post Comments API Route (`src/app/api/posts/[id]/comments/route.ts`)**:
  - `POST` method retrieves authentication at line 71: `const user = await getUserFromRequest();`.
  - It fetches the post record at line 123: `const post = await prisma.post.findUnique({ where: { id: postId } });`.
- **Auth Library (`src/lib/auth.ts`)**:
  - `getUserFromRequest()` is defined at lines 35-58. It returns the user record from the database if a valid cookie session is present, and `null` otherwise.
- **Project Configuration (`package.json`)**:
  - No testing framework or script is configured under dependencies or scripts (lines 5-11, 23-37).
  - The E2E testing orchestrator's progress report (`.agents/sub_orch_e2e_testing/progress.md`) confirms that E2E test suites are planned but not yet implemented.

---

## 2. Logic Chain
- **Database Schema**:
  - Adding `allowComments Boolean @default(true)` and `allowStrangerComments Boolean @default(true)` within the scalar fields block of the `Post` model (e.g. at line 69) will introduce the necessary database fields with correct default values.
- **Post API Creation & Retrieval**:
  - By destructuring `allowComments` and `allowStrangerComments` from the body at `src/app/api/posts/route.ts:165` and passing them to `prisma.post.create` (lines 222-238), these options will be stored on creation.
  - Adding these fields to the mapping blocks in `src/app/api/posts/route.ts` (lines 97-110) and `src/app/api/posts/[id]/route.ts` (lines 79-93) ensures that they are returned to consumers when querying posts.
- **Comment Privacy Enforcement**:
  - Since `getUserFromRequest()` returns `null` for unauthenticated requests, we can define a guest/stranger as `!user`.
  - Adding checks immediately after fetching the post (at line 123 in `src/app/api/posts/[id]/comments/route.ts`):
    1. If `post.allowComments` is false, block all comments with status `403`.
    2. If `post.allowStrangerComments` is false and `user` is null (guest/stranger), block comment creation with status `403`.
  - Using status `403` and the standard `error()` helper ensures consistent error formats (`{ error: "message" }`) across the codebase.

---

## 3. Caveats
- No test runner or framework currently exists in the codebase. Testing relies on running the Next.js server locally and executing a custom API-based verification script or manually checking the database.
- It is assumed that "strangers" are exclusively guest/anonymous users (where `user === null`), and that authenticated users are allowed to comment even if `allowStrangerComments` is set to `false`.

---

## 4. Conclusion
- The backend database schema needs two new Boolean fields on the `Post` model, defaulting to `true`.
- The APIs (`POST /api/posts`, `GET /api/posts`, and `GET /api/posts/[id]`) must be updated to process and serialize these new fields.
- The `POST /api/posts/[id]/comments` route must validate these settings immediately after the post lookup, returning a `403` Forbidden response with an error message on validation failure.

---

## 5. Verification Method
1. Run `npx prisma db push` to apply schema changes to the SQLite database.
2. Run `npm run build` to ensure there are no compilation or type-checking issues with the updated code.
3. Start the dev server using `npm run dev`.
4. Run a verification script that uses `fetch` to test:
   - Creating a post with comment options.
   - Commenting anonymously or as a user on a post with comments disabled.
   - Commenting anonymously or as a user on a post with stranger comments disabled.
   - Inspecting response status codes (expect `403` for forbidden comments) and body messages.
