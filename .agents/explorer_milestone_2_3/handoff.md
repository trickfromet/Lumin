# Handoff Report: Backend DB Schema & Comment Privacy API Constraints

This report covers the read-only exploration and analysis of the backend changes required to implement post comments privacy toggles (`allowComments` and `allowStrangerComments`).

---

## 1. Observation

We directly observed and analyzed the following files and code locations:

### A. Prisma Schema (`prisma/schema.prisma`)
The `Post` model definition starts at line 53 and runs through line 81:
```prisma
model Post {
  id               Int       @id @default(autoincrement())
  userId           Int?
  user             User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  nickname         String
  content          String?
  encryptedContent String?
  iv               String?
  authTag          String?
  isEncrypted      Boolean   @default(false)
  imageUrl         String?
  categoryId       Int?
  category         Category? @relation(fields: [categoryId], references: [id])
  isHidden         Boolean   @default(false)
  language         String    @default("zh")
  campaign         String?                             // 冷启动标记: "initial_launch" 等，用于追踪宣传效果
  createdAt        DateTime  @default(now())

  likes      Like[]
  comments   Comment[]
  metoos     MeToo[]
  tags       PostTag[]
  reports    Report[]
  collections Collection[]

  @@index([categoryId])
  @@index([userId])
  @@index([createdAt])
}
```

### B. Post Creation & Retrieval Route (`src/app/api/posts/route.ts`)
- **GET Handler** (lines 24-118):
  Queries database at lines 53-66 using `prisma.post.findMany` (without selection filters). Maps the query results to a response object array `enrichedPosts` (lines 81-110).
- **POST Handler** (lines 121-275):
  Checks rate limits and user authentication. Parses JSON request body:
  ```typescript
  const body = await request.json();
  const { content, imageUrl, tags, categoryId } = body;
  ```
  Creates post in DB at lines 222-238:
  ```typescript
  const post = await prisma.post.create({
    data: {
      userId: user?.id || null,
      nickname: user?.nickname || guestNickname,
      encryptedContent: encrypted,
      iv,
      authTag,
      isEncrypted: true,
      imageUrl: imageUrl || null,
      language: detectLanguage(content.trim()),
      categoryId: finalCategoryId,
      tags: {
        create: finalTags
          .filter((t) => typeof t === "string" && t.length > 0)
          .map((tag) => ({ tag })),
      },
    },
    ...
  });
  ```
  Returns response at lines 258-270.

### C. Single Post Route (`src/app/api/posts/[id]/route.ts`)
- **GET Handler** (lines 14-94):
  Fetches the post from the DB at lines 25-32 and returns a formatted JSON payload containing specific attributes at lines 79-93.

### D. Comments API Route (`src/app/api/posts/[id]/comments/route.ts`)
- **POST Handler** (lines 67-184):
  Retrieves user session via `getUserFromRequest()` (line 71):
  ```typescript
  const user = await getUserFromRequest();
  const ip = getIpFromRequest(request);
  ```
  If `user` is falsy, it processes the request as a guest.
  Retrieves the post from the DB at line 123:
  ```typescript
  const post = await prisma.post.findUnique({ where: { id: postId } });
  ```
  Creates the comment in the database using `prisma.comment.create` (lines 158-170).

### E. Authenticated User / Session Retrieval (`src/lib/auth.ts`)
- `getUserFromRequest` (lines 35-58):
  Retrieves the `th_token` cookie, verifies it using JWT, and fetches the `User` model from the database. Returns `null` if the user is unauthenticated or the session is invalid.

### F. API Response Formatters (`src/lib/api-response.ts`)
- Helper functions `success(data, status = 200)` and `error(message, status = 400)` format JSON responses. `forbidden(message)` formats a 403 response.

---

## 2. Logic Chain

Based on the observations above, we reason as follows:

1. **Database Schema**: To support post comment toggles, we must introduce two Boolean settings to the `Post` model in `prisma/schema.prisma` (`allowComments` and `allowStrangerComments`). Both must default to `true` according to the requirement spec.
2. **Post Creation**: When creating a post in `POST /api/posts`, we need to parse these two optional toggles from the JSON payload. We must validate and default them to `true` if not provided. They should then be passed to the `prisma.post.create` parameters and returned in the resulting JSON payload.
3. **Post Retrieval**: Both `GET /api/posts` and `GET /api/posts/[id]` map database post objects into clean client-facing JSON objects. We must modify these mappings to explicitly include `allowComments` and `allowStrangerComments`.
4. **Commenting Constraints**: In `POST /api/posts/[id]/comments`, the commenter's session is determined by `getUserFromRequest()`. If `user === null`, the request comes from an anonymous guest ("stranger"). Once we fetch the target post:
   - If `post.allowComments` is `false`, we block the comment.
   - If `post.allowStrangerComments` is `false` and `user === null`, we block the comment.
5. **Errors & Status Codes**: If comment creation fails due to these toggles, the system must return `403` (Forbidden) or `422` (Unprocessable Entity). Since these are permission-based access restrictions, `403` matches typical REST APIs. The response body must be formatted using the existing `error(...)` utility, resulting in `{ "error": "message" }`.

---

## 3. Caveats

- **Prisma Client Edge**: The client uses SQLite locally via Prisma. Running `npx prisma generate` is required after schema modifications to prevent TypeScript compilation errors.
- **SQLite Migrations**: In dev mode, SQLite database changes can be applied via `npx prisma db push` or `npx prisma migrate dev`. `npx prisma migrate dev` is preferred to maintain a clean migration history.
- **Session/Token Mocking**: For E2E/manual verification of registered user status vs. guest status, the verification script must register a test user, extract the `Set-Cookie` header, and pass it back in Subsequent headers to maintain a session.

---

## 4. Conclusion

The implementation requires the following specific modifications:
1. Append `allowComments` and `allowStrangerComments` as Booleans defaulting to true in `prisma/schema.prisma`.
2. Update `src/app/api/posts/route.ts` to accept these options on `POST`, store them, and return them on both `POST` and `GET`.
3. Update `src/app/api/posts/[id]/route.ts` to return these options on `GET`.
4. Enforce two checks in `src/app/api/posts/[id]/comments/route.ts` on `POST` to return a `403` status with `{ "error": "..." }` when privacy constraints are violated.

---

## 5. Verification Method

Since there is no automated test runner configured in the workspace, verification can be achieved by:
1. Running the project: `npm run dev`
2. Executing a custom verification script (as provided in `analysis.md`) that calls the API endpoints to create posts with different combinations of privacy flags, attempts to comment on them as both a guest and a registered user, and asserts the correct HTTP status codes (201, 403, 422).
3. If an E2E testing framework gets introduced later, these test scenarios should be incorporated into it.
