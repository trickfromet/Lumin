# Backend Database Schema Changes and API Constraints for Post Comments Privacy Toggles

This report provides the detailed exploration and analysis for the implementation of backend database schema changes and API constraints for post comments privacy toggles.

---

## 1. Database Schema Changes (`prisma/schema.prisma`)

### Location of Changes
In `prisma/schema.prisma`, the `Post` model represents posts in the application. The new fields `allowComments` and `allowStrangerComments` should be added as scalar fields right after the existing scalar fields (such as `createdAt`) and before the relationship declarations.

### Verbatim Schema Additions
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
  
  // 新增隐私控制字段
  allowComments         Boolean   @default(true)
  allowStrangerComments  Boolean   @default(true)

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

### Migration Process
After adding the fields, run the following commands to regenerate the Prisma client and sync the schema with the SQLite database:
```bash
npx prisma generate
npx prisma db push
# Or, to maintain migration files in dev:
npx prisma migrate dev --name add_post_comment_toggles
```

---

## 2. Post Creation & Retrieval APIs (`src/app/api/posts/route.ts`)

### Current Request Processing
- **GET**: 
  - Parses pagination parameters (`page`, `pageSize`, `skip`) and filters (`categoryId`, `userId`, `language`, `tag`).
  - Identifies the current logged-in user to find and exclude posts by blocked users.
  - Queries `prisma.post.findMany` (since no `select` is specified, it returns all fields including the new columns automatically).
  - Maps database objects to response structures under `enrichedPosts`.
- **POST**:
  - Authenticates the user (`getUserFromRequest`). If none, handles guest rate limits/nickname generation.
  - Parses request JSON payload.
  - Runs content moderation (`performModeration` or `performGuestModeration`).
  - Encrypts content, processes tags/categories, and creates the post (`prisma.post.create`).
  - Returns the post data (with decrypted content for the author).

### Proposed Changes

#### POST Handler Modifications
We need to parse `allowComments` and `allowStrangerComments` from the request body (defaulting to `true` if omitted or if not a boolean value) and persist them to the database.

```typescript
// 1. In POST function, parse new options from body:
const { content, imageUrl, tags, categoryId } = body;
const allowComments = typeof body.allowComments === "boolean" ? body.allowComments : true;
const allowStrangerComments = typeof body.allowStrangerComments === "boolean" ? body.allowStrangerComments : true;

// 2. In prisma.post.create data object:
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
    allowComments,          // <-- Add here
    allowStrangerComments,   // <-- Add here
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

// 3. In return success response payload:
return success(
  {
    ...post,
    content: content.trim(),
    encryptedContent: undefined,
    iv: undefined,
    authTag: undefined,
    isEncrypted: undefined,
    tags: post.tags.map((t) => t.tag),
    allowComments: post.allowComments,            // <-- Add here
    allowStrangerComments: post.allowStrangerComments,  // <-- Add here
    guestHint,
  },
  201,
);
```

#### GET Handler Modifications
Ensure that the returned post list elements contain the new toggles:

```typescript
// In GET enrichedPosts mapping:
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
  allowComments: post.allowComments,             // <-- Add here
  allowStrangerComments: post.allowStrangerComments,   // <-- Add here
};
```

---

## 3. Single Post Retrieval API (`src/app/api/posts/[id]/route.ts`)

### Current Request Processing
- **GET**: 
  - Validates `postId` from URL params.
  - Queries `prisma.post.findUnique`.
  - Performs hidden and blocker checks.
  - Decrypts post content.
  - Returns the post details in `success({ post: { ... } })`.

### Proposed Changes
Update the returned post object inside `success` to include the toggles:

```typescript
// In GET handler response structure:
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
    allowComments: post.allowComments,             // <-- Add here
    allowStrangerComments: post.allowStrangerComments,   // <-- Add here
  },
});
```

---

## 4. Comment Creation Restrictions (`src/app/api/posts/[id]/comments/route.ts`)

### Session Retrieval & User Type Definition
- **How session is retrieved**: The API uses `const user = await getUserFromRequest();` which parses cookies for the token (`th_token`).
- **Definition of "guest/anonymous" user**: In the current codebase, a guest/anonymous user is defined as a user request where `user === null` (meaning no authenticated session exists).

### Proposed Privacy Constraint Logic
Add validation checks right after fetching the post (`const post = await prisma.post.findUnique(...)`):

```typescript
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return error("帖子不存在", 404);
  }

  // 校验评论功能是否开启
  if (!post.allowComments) {
    return error("该帖子已关闭评论功能", 403); // Returns 403 Forbidden
  }

  // 校验是否允许游客评论
  if (!post.allowStrangerComments && !user) {
    return error("该帖子仅允许注册用户评论", 403); // Returns 403 Forbidden
  }
```

### HTTP Status Code & Response Body on Failure
- **HTTP Status Code**: `403` (Forbidden) is recommended as the standard REST response for action permission denials, although the scope contract allows `422` (Unprocessable Entity). 
- **Response Body**: The standard error structure returned by the helper `error(message, status)` is used:
  ```json
  {
    "error": "该帖子已关闭评论功能"
  }
  ```

---

## 5. Verification Method

Since there is no automated test runner (like Vitest or Jest) configured in `package.json`, we should verify this through a custom test script. Below is a recommended Node.js script (`verify-comments-privacy.js`) that verifies the endpoints against a running local development server (`http://localhost:3000`).

### Verification Script Proposal

```javascript
/**
 * Verification Script: verify-comments-privacy.js
 * 
 * Instructions:
 * 1. Run local development server: npm run dev
 * 2. Run this script using node: node verify-comments-privacy.js
 */

const BASE_URL = "http://localhost:3000";

async function runTests() {
  console.log("Starting verification for post comments privacy toggles...\n");

  // Step 1: Register a test user
  const randomSuffix = Math.floor(Math.random() * 100000);
  const testEmail = `user${randomSuffix}@test.com`;
  const testPassword = "Password123";

  console.log(`[Setup] Registering test user: ${testEmail}`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  
  if (!regRes.ok) {
    console.error("Failed to register test user:", await regRes.text());
    process.exit(1);
  }
  
  const regData = await regRes.json();
  const authCookie = regRes.headers.get("set-cookie");
  console.log("Registered successfully. Cookie acquired.\n");

  // ==========================================
  // Test Scenario 1: Post with allowComments = false
  // ==========================================
  console.log("--- Test Case 1: Post with allowComments = false ---");
  const post1Res = await fetch(`${BASE_URL}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authCookie ? { "Cookie": authCookie } : {}),
    },
    body: JSON.stringify({
      content: "This is a test post that does not allow comments.",
      allowComments: false,
    }),
  });
  const post1 = await post1Res.json();
  console.log("Created post ID:", post1.id);
  console.log("Post attributes:", { allowComments: post1.allowComments, allowStrangerComments: post1.allowStrangerComments });

  // Try to comment as authenticated user
  const comment1UserRes = await fetch(`${BASE_URL}/api/posts/${post1.id}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authCookie ? { "Cookie": authCookie } : {}),
    },
    body: JSON.stringify({ content: "Trying to comment" }),
  });
  console.log("Registered user comment response status:", comment1UserRes.status);
  const comment1UserBody = await comment1UserRes.json();
  console.log("Registered user comment response body:", comment1UserBody);
  if (comment1UserRes.status === 403 || comment1UserRes.status === 422) {
    console.log("✅ Match expected failure (403/422).");
  } else {
    console.error("❌ Unexpected status code!");
  }

  // ==========================================
  // Test Scenario 2: Post with allowStrangerComments = false
  // ==========================================
  console.log("\n--- Test Case 2: Post with allowStrangerComments = false ---");
  const post2Res = await fetch(`${BASE_URL}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authCookie ? { "Cookie": authCookie } : {}),
    },
    body: JSON.stringify({
      content: "This is a test post that does not allow guest comments.",
      allowStrangerComments: false,
    }),
  });
  const post2 = await post2Res.json();
  console.log("Created post ID:", post2.id);

  // Try to comment as guest (no Cookie header)
  console.log("Posting comment as guest...");
  const comment2GuestRes = await fetch(`${BASE_URL}/api/posts/${post2.id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Trying to comment as guest" }),
  });
  console.log("Guest comment response status:", comment2GuestRes.status);
  const comment2GuestBody = await comment2GuestRes.json();
  console.log("Guest comment response body:", comment2GuestBody);
  if (comment2GuestRes.status === 403 || comment2GuestRes.status === 422) {
    console.log("✅ Match expected failure for guests (403/422).");
  } else {
    console.error("❌ Unexpected status code for guest!");
  }

  // Try to comment as registered user
  console.log("Posting comment as registered user...");
  const comment2UserRes = await fetch(`${BASE_URL}/api/posts/${post2.id}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authCookie ? { "Cookie": authCookie } : {}),
    },
    body: JSON.stringify({ content: "Hello as a registered user!" }),
  });
  console.log("Registered user comment response status:", comment2UserRes.status);
  if (comment2UserRes.status === 201) {
    console.log("✅ Match expected success for registered users (201).");
  } else {
    console.error("❌ Unexpected status code:", comment2UserRes.status, await comment2UserRes.text());
  }

  // ==========================================
  // Test Scenario 3: Verify Retrieval of fields in GET APIs
  // ==========================================
  console.log("\n--- Test Case 3: Verify fields in GET ---");
  const getSinglePostRes = await fetch(`${BASE_URL}/api/posts/${post2.id}`);
  const singlePostData = await getSinglePostRes.json();
  console.log("GET /api/posts/[id] returns:", {
    allowComments: singlePostData.post.allowComments,
    allowStrangerComments: singlePostData.post.allowStrangerComments
  });
  if (singlePostData.post.allowComments === true && singlePostData.post.allowStrangerComments === false) {
    console.log("✅ Successfully returned fields on single post fetch.");
  } else {
    console.error("❌ Fields returned in GET single post did not match!");
  }

  console.log("\nAll tests completed.");
}

runTests().catch(console.error);
```
