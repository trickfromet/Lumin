# Post Comments Privacy Controls: Database Schema & API Constraints Exploration Report

This report analyzes the requirements and outlines the necessary changes in the database schema and REST API endpoints to support post comments privacy toggles (specifically, `allowComments` and `allowStrangerComments`).

---

## 1. Prisma Schema Changes (`prisma/schema.prisma`)

### Analysis of the `Post` Model
The `Post` model is defined in `prisma/schema.prisma` (lines 53-81). Currently, it contains fields such as `isEncrypted`, `isHidden`, and `language`.

### Proposed Changes
We should add two new boolean fields with default values of `true`:
- `allowComments`: Boolean, default `true` (determines if commenting is enabled on this post).
- `allowStrangerComments`: Boolean, default `true` (determines if guest/anonymous/unregistered users are allowed to comment).

These fields should be placed near existing boolean flags like `isEncrypted` or `isHidden` for clean formatting.

**Schema Snippet:**
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
  allowComments         Boolean   @default(true)  // <-- New Field
  allowStrangerComments Boolean   @default(true)  // <-- New Field
  language         String    @default("zh")
  campaign         String?                             // 冷启动标记
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

### Next Steps for DB Update
After changing the schema, run the following commands to apply the changes to SQLite and regenerate the Prisma client:
```bash
npx prisma generate
npx prisma db push
```

---

## 2. Post Creation API (`src/app/api/posts/route.ts`)

### Request Processing Flow
- **GET Request**: Parses page parameters and filters (e.g. `categoryId`, `tag`). If the current user is authenticated (via `getUserFromRequest()`), it filters out posts by blocked users. It then retrieves posts from Prisma and decrypts the encrypted posts.
- **POST Request**: Retrieves the user session using `getUserFromRequest()` and the client IP using `getIpFromRequest(request)`. It checks rate limits and ban status. It extracts parameters from the request JSON body, validates and moderates the content, encrypts the post content, and saves it using `prisma.post.create()`.

### Required Changes

#### A. GET Method Updates
In `src/app/api/posts/route.ts`, within the `GET` function, the `enrichedPosts` array mapping (around line 97) must explicitly include the new privacy settings so that post lists contain these toggles:
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
      allowComments: post.allowComments,                 // <-- New Field
      allowStrangerComments: post.allowStrangerComments, // <-- New Field
    };
```

#### B. POST Method Updates
1. Extract the new settings from the JSON request body (around line 165):
   ```typescript
   const { content, imageUrl, tags, categoryId, allowComments, allowStrangerComments } = body;
   ```
2. Pass these options into the `prisma.post.create()` payload (around line 223), ensuring safe fallbacks to `true` if they are not provided or are of incorrect types:
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

---

## 3. Single Post Retrieval API (`src/app/api/posts/[id]/route.ts`)

### Request Processing Flow
- **GET Request**: Checks route parameter `id`, queries the database via `prisma.post.findUnique()`, checks for visibility (`isHidden`), checks blocker relations, decrypts content, check if the current user metoo'd the post, and returns the post object.

### Required Changes
Within the `success()` response mapping (lines 80-92), we must explicitly return `allowComments` and `allowStrangerComments`:
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
      allowComments: post.allowComments,                 // <-- New Field
      allowStrangerComments: post.allowStrangerComments, // <-- New Field
    },
  });
```

---

## 4. Comment Creation API (`src/app/api/posts/[id]/comments/route.ts`)

### Request Processing Flow
- **POST Request**: Fetches the caller user session (`getUserFromRequest()`) and IP (`getIpFromRequest(request)`). Performs rate limit and ban checks. Retrieves the target post `const post = await prisma.post.findUnique({ where: { id: postId } });`. Validates body payload, checks moderation, validates the optional `parentId`, creates the comment using `prisma.comment.create()`, and returns 201.

### Session & Guest Definition
- **User Authentication**: The current session is fetched using `const user = await getUserFromRequest();` (which decodes the JWT token from the `th_token` cookie and fetches the corresponding `User` from the database).
- **Stranger / Guest User Definition**: A "stranger" or "guest/anonymous" user is identified by the absence of a logged-in session: `user === null` (or `!user`).

### Privacy Toggle Constraints Enforcement
We need to insert verification checks immediately after fetching the post (line 123) and before processing the request body:

```typescript
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  // 1. Check if comments are allowed on this post
  if (!post.allowComments) {
    return error("该帖子已关闭评论功能", 403);
  }

  // 2. Check if stranger comments are allowed (block guests if disallowed)
  if (!post.allowStrangerComments && !user) {
    return error("该帖子仅允许注册用户评论，请登录后发表评论", 403);
  }
```

### Response Status and Body on Failure
- **HTTP Status Code**: `403` (Forbidden) is standard and appropriate when access is rejected due to privacy toggles (`allowComments` or `allowStrangerComments`). A `422` (Unprocessable Entity) is also acceptable. The standard response helper `error(message, 403)` should be used to yield a consistent `403` error.
- **Response Body**:
  The failure response uses the `error` helper from `@/lib/api-response.ts`, which returns a JSON payload containing the error message:
  ```json
  {
    "error": "该帖子已关闭评论功能"
  }
  ```

---

## 5. Verification Method

Since there is no existing testing framework (such as Jest or Playwright) configured in `package.json`, verification should be conducted using a standalone Node.js integration script. 

### Proposed Script: `scripts/verify-privacy-toggles.js`
This script uses `fetch` to request route handlers locally after launching `npm run dev`. It checks all 4 main scenarios:

1. **All Allowed**: Post with `allowComments: true` and `allowStrangerComments: true` enables both user and guest comment creation.
2. **No Comments**: Post with `allowComments: false` blocks both user and guest comment creation (returns `403`).
3. **No Stranger Comments**: Post with `allowStrangerComments: false` allows logged-in user comment creation but blocks guest/anonymous comment creation (returns `403`).
4. **Endpoint Fields**: Confirms `GET /api/posts` and `GET /api/posts/[id]` include the toggle fields in their response.

An example code structure for this verification script is provided in the handoff document.
