# Exploration Report: Post Comments Privacy Controls and DB Schema

## Executive Summary
This report analyzes the backend requirements for implementing privacy controls on post comments, specifically the options `allowComments` and `allowStrangerComments` (both default to `true`). We detail the database schema modifications using Prisma and the changes required for the API routes for post creation, post retrieval, and comment creation.

---

## 1. Prisma Schema Changes
### Target Location
In `prisma/schema.prisma`, the `Post` model (lines 53-81) defines the fields of the post. The two new boolean fields (`allowComments` and `allowStrangerComments`) should be added to the scalar fields section of the `Post` model. Placing them immediately after the `campaign` field (or `isHidden` field) and before the relation fields/`createdAt` keeps the schema clean and well-structured.

### Proposed Code Block in `prisma/schema.prisma`
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
  allowComments    Boolean   @default(true)            // 是否允许评论，默认允许
  allowStrangerComments Boolean @default(true)         // 是否允许游客/匿名评论，默认允许
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

---

## 2. Post Route (`src/app/api/posts/route.ts`)

### Request Processing & DB Interaction Flow

#### **GET /api/posts**
1. **Request Processing**:
   - Parses pagination parameters (`page`, `pageSize`, `skip`) using the `parsePagination` helper.
   - Extracts filters: `categoryId`, `tag`, `userId`, `language` from search parameters.
   - Retrieves the authenticated user via `getUserFromRequest()`. If the user is authenticated, it queries for blocked user IDs and excludes their posts.
2. **Database Interaction**:
   - Queries `prisma.userBlock.findMany` to find blocked users (if authenticated).
   - Queries `prisma.post.findMany` with filter, pagination, order, and relation inclusions (`category`, `tags`, and relation counts).
   - Queries `prisma.post.count` to get the total number of posts.
   - Queries `prisma.meToo.findMany` to find posts the current user has "me-too'd".
3. **Decryption and Mapping**:
   - Decrypts the post content if `isEncrypted` is true using `decryptContent`.
   - Maps each database post record into a custom object structure returned inside `success()`.

#### **POST /api/posts**
1. **Request Processing**:
   - Checks authentication via `getUserFromRequest()`. If authenticated, checks if user is banned via `checkBanStatus()`.
   - If unauthenticated (Guest mode), checks if the guest IP is banned, checks if guest post count exceeds the limit of 5 posts, and generates/retrieves a guest nickname.
   - Validates rate limit using `checkRateLimit` (different key formats for user vs guest).
   - Parses the JSON request body.
   - Validates that `content` is not empty.
   - Moderates content via `performModeration()` (user) or `performGuestModeration()` (guest).
   - Encrypts content using `encryptContent()`.
   - Performs automatic classification of the category if not provided.
   - Formulates and filters post tags.
2. **Database Interaction**:
   - Checks guest status using `prisma.guest.findUnique`.
   - Creates the post record using `prisma.post.create`.
   - Upserts the guest count using `prisma.guest.upsert` if unauthenticated.
3. **Response**:
   - Returns the created post object with unencrypted content (and success code 201).

### Required Changes
#### **For GET `/api/posts`**
In the mapping function inside `enrichedPosts` (lines 97-110), include the new fields:
```typescript
    return {
      id: post.id,
      nickname: post.nickname,
      content: decryptedContent,
      imageUrl: post.imageUrl,
      category: post.category,
      tags: post.tags.map((t) => t.tag),
      createdAt: post.createdAt,
      metooCount: post._count.metoos,
      metooTier: getMeTooTier(post._count.metoos),
      commentCount: post._count.comments,
      userHasMetoed: userMetooSet.has(post.id),
      allowComments: post.allowComments,
      allowStrangerComments: post.allowStrangerComments,
    };
```

#### **For POST `/api/posts`**
1. Extract `allowComments` and `allowStrangerComments` from request body destructuring (line 165):
   ```typescript
   const { content, imageUrl, tags, categoryId, allowComments, allowStrangerComments } = body;
   ```
2. Pass them into `prisma.post.create` data payload, defaulting to `true` if undefined or not a boolean:
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
       allowComments: typeof allowComments === "boolean" ? allowComments : true,
       allowStrangerComments: typeof allowStrangerComments === "boolean" ? allowStrangerComments : true,
       tags: {
         create: finalTags
           .filter((t) => typeof t === "string" && t.length > 0)
           .map((tag) => ({ tag })),
       },
     },
     include: {
       category: { select: { id: true, name: true, icon: true } },
       tags: { select: { tag: true } },
     },
   });
   ```
   *Note: Spreading the `post` object (`...post`) at the return statement will automatically include these fields in the response.*

---

## 3. Single Post Route (`src/app/api/posts/[id]/route.ts`)

### Request Processing & DB Interaction Flow
#### **GET /api/posts/[id]**
1. Validates the post ID from URL params.
2. Queries the database using `prisma.post.findUnique` with inclusions.
3. If not found or `isHidden` is true, returns 404.
4. Retrieves authenticated user and checks if user blocked the post author (or vice versa), returning 404 if blocked.
5. Decrypts post content.
6. Checks if the user has "me-too'd" this post.
7. Returns a mapped post object in the success response.

### Required Changes
In the returned post object mapping (lines 79-93), explicitly add the two fields:
```typescript
  return success({
    post: {
      id: post.id,
      nickname: post.nickname,
      content: decryptedContent,
      imageUrl: post.imageUrl,
      category: post.category,
      tags: post.tags.map((t) => t.tag),
      createdAt: post.createdAt,
      metooCount: post._count.metoos,
      metooTier: getMeTooTier(post._count.metoos),
      commentCount: post._count.comments,
      userHasMetoed,
      allowComments: post.allowComments,
      allowStrangerComments: post.allowStrangerComments,
    },
  });
```

---

## 4. Comment Route (`src/app/api/posts/[id]/comments/route.ts`)

### Request Processing & DB Interaction Flow
#### **POST /api/posts/[id]/comments**
1. Retrieves authentication using `getUserFromRequest()`.
2. Validates ban status (if user is authenticated).
3. If guest, retrieves/creates the `Guest` record by IP, check if device is banned, and generates/resolves a nickname.
4. Checks comment rate limit.
5. Validates the post ID, and fetches the target post from the database.
6. Parses body JSON to extract comment `content` and `parentId`.
7. Validates that `content` is not empty.
8. Runs content moderation.
9. Validates `parentId` if it is a reply.
10. Saves comment to DB using `prisma.comment.create`.
11. Returns the comment response with success status 201.

### Auth Session Retrieval
The route retrieves the user session using:
```typescript
const user = await getUserFromRequest();
```
This helper reads the `th_token` cookie, verifies the JWT payload, and retrieves the corresponding user record from the `User` table. If the session is invalid or not present, it returns `null`.

### Defining a "Stranger"
A "stranger" or "guest/anonymous" user is defined in this codebase simply as a client request where **no active user session exists** (i.e. `user === null` or `!user`).

### Checks Structure
The privacy constraint checks must be executed **immediately after fetching the post object** (line 123) and before parsing the comment body, to fail fast.

```typescript
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  // 1. Check if comments are allowed at all
  if (!post.allowComments) {
    return error("该帖子已关闭评论功能", 403);
  }

  // 2. Check if stranger comments are allowed (only relevant if commenter is not authenticated)
  if (!post.allowStrangerComments && !user) {
    return error("该帖子仅允许注册用户评论", 403);
  }
```

### HTTP Status Code & Response Body
- **Status Code**: `403` (Forbidden) is the most appropriate status code. It indicates that the server understands the request but refuses to authorize it due to post settings. The project has a `forbidden(message)` helper in `src/lib/api-response.ts` or we can use the `error(message, 403)` function.
- **Response Body**: `{ error: "该帖子已关闭评论功能" }` or `{ error: "该帖子仅允许注册用户评论" }`. This structure matches the response body of other error responses in the application.

---

## 5. Verification Strategy

### Available Infrastructure
The project currently does **not** have an active test runner or configured test framework (like Jest or Vitest) in `package.json`. The E2E testing orchestrator's progress tracker (`.agents/sub_orch_e2e_testing/progress.md`) shows that the E2E test plan and test suite implementation are still planned or in early design phase. 

### Proposed Verification Method
To verify these backend API constraints, we recommend writing a standalone Node.js integration script (e.g. `scripts/verify-privacy-toggles.js`) which runs against a running local development server (`http://localhost:3000`).

The script would:
1. **Helper - API Request**: Send requests using the built-in `fetch` API.
2. **Helper - Auth Session**: Sign up / login a mock user to retrieve a cookie token, and keep another request anonymous.
3. **Test Case 1: Post creation options**:
   - Call `POST /api/posts` with `allowComments: false` and check that the returned post structure has `allowComments: false`.
   - Call `POST /api/posts` with `allowComments: true` and `allowStrangerComments: false` and check that those values are returned.
4. **Test Case 2: Blocked comments (allowComments: false)**:
   - Attempt to post a comment to the post with `allowComments: false` anonymously -> Expect `403` (Forbidden).
   - Attempt to post a comment to the same post with a logged-in user -> Expect `403` (Forbidden).
5. **Test Case 3: Stranger comments restriction (allowStrangerComments: false)**:
   - Attempt to post a comment to the post with `allowStrangerComments: false` anonymously -> Expect `403` (Forbidden).
   - Attempt to post a comment to the same post with a logged-in user -> Expect `201` (Success).
6. **Test Case 4: Retrieval verification**:
   - Call `GET /api/posts` and `GET /api/posts/[id]` and verify that the fields `allowComments` and `allowStrangerComments` are present in the response body.

This verification script ensures the API endpoints behave as contracted without needing to install complex testing frameworks initially.
