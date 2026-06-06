import { prisma } from "../lib/prisma";
import { signToken } from "../lib/auth";

const BASE_URL = "http://localhost:3001";

async function runTests() {
  console.log("=== Starting Privacy Toggles Verification Tests ===");

  // 1. Setup Test User
  console.log("Setting up test user...");
  let testUser = await prisma.user.findFirst({
    where: { nickname: "_PrivacyTest_User" },
  });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        nickname: "_PrivacyTest_User",
        email: "privacytest@example.com",
        passwordHash: "dummyhash",
        role: "user",
      },
    });
  }

  const token = await signToken(testUser.id);
  const userCookie = `th_token=${token}`;

  // Clean up any old test posts/comments/users
  console.log("Cleaning up old test data...");
  const oldPosts = await prisma.post.findMany({
    where: { nickname: { startsWith: "_PrivacyTest_" } },
  });
  const oldPostIds = oldPosts.map((p) => p.id);
  if (oldPostIds.length > 0) {
    await prisma.comment.deleteMany({
      where: { postId: { in: oldPostIds } },
    });
    await prisma.post.deleteMany({
      where: { id: { in: oldPostIds } },
    });
  }

  const postsCreated: Record<string, number> = {};

  // Helper to make POST /api/posts requests
  async function createPost(payload: Record<string, unknown>, cookie?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cookie) {
      headers["Cookie"] = cookie;
    }
    const res = await fetch(`${BASE_URL}/api/posts`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create post. Status: ${res.status}, Body: ${errText}`);
    }
    return await res.json();
  }

  // Helper to make POST /api/posts/[id]/comments requests
  async function createComment(postId: number, content: string, cookie?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (cookie) {
      headers["Cookie"] = cookie;
    }
    const res = await fetch(`${BASE_URL}/api/posts/${postId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });
    return { status: res.status, data: await res.json() };
  }

  // Helper to make GET /api/posts/[id]
  async function getPostDetail(postId: number) {
    const res = await fetch(`${BASE_URL}/api/posts/${postId}`);
    if (!res.ok) {
      throw new Error(`Failed to get post detail for ${postId}. Status: ${res.status}`);
    }
    return await res.json();
  }

  // 2. Test Post Creation & Field Propagation
  console.log("\n--- Testing Post Creation & Field Validation ---");

  // Post A: allowComments=true, allowStrangerComments=true
  console.log("Creating Post A (allowComments=true, allowStrangerComments=true)...");
  const postA = await createPost(
    {
      content: "_PrivacyTest_ Post A: Open for all comments",
      allowComments: true,
      allowStrangerComments: true,
    },
    userCookie
  );
  if (postA.allowComments !== true || postA.allowStrangerComments !== true) {
    throw new Error("Post A fields incorrect: " + JSON.stringify(postA));
  }
  postsCreated["A"] = postA.id;
  console.log("✓ Post A created successfully with ID: " + postA.id);

  // Post B: allowComments=false, allowStrangerComments=true
  console.log("Creating Post B (allowComments=false, allowStrangerComments=true)...");
  const postB = await createPost(
    {
      content: "_PrivacyTest_ Post B: Comments completely disabled",
      allowComments: false,
      allowStrangerComments: true,
    },
    userCookie
  );
  if (postB.allowComments !== false || postB.allowStrangerComments !== true) {
    throw new Error("Post B fields incorrect: " + JSON.stringify(postB));
  }
  postsCreated["B"] = postB.id;
  console.log("✓ Post B created successfully with ID: " + postB.id);

  // Post C: allowComments=true, allowStrangerComments=false
  console.log("Creating Post C (allowComments=true, allowStrangerComments=false)...");
  const postC = await createPost(
    {
      content: "_PrivacyTest_ Post C: No stranger comments",
      allowComments: true,
      allowStrangerComments: false,
    },
    userCookie
  );
  if (postC.allowComments !== true || postC.allowStrangerComments !== false) {
    throw new Error("Post C fields incorrect: " + JSON.stringify(postC));
  }
  postsCreated["C"] = postC.id;
  console.log("✓ Post C created successfully with ID: " + postC.id);

  // Post D: Default settings (no toggles sent)
  console.log("Creating Post D (default settings)...");
  const postD = await createPost(
    {
      content: "_PrivacyTest_ Post D: Default settings test",
    },
    userCookie
  );
  if (postD.allowComments !== true || postD.allowStrangerComments !== true) {
    throw new Error("Post D default fields incorrect: " + JSON.stringify(postD));
  }
  postsCreated["D"] = postD.id;
  console.log("✓ Post D created successfully with ID: " + postD.id);

  // 3. Test Retrieval API (GET /api/posts and GET /api/posts/[id])
  console.log("\n--- Testing Post Retrieval Fields ---");

  console.log("Fetching GET /api/posts...");
  const listRes = await fetch(BASE_URL + "/api/posts");
  if (!listRes.ok) {
    throw new Error("GET /api/posts failed. Status: " + listRes.status);
  }
  const listData = await listRes.json();
  interface TestPost {
    id: number;
    allowComments: boolean;
    allowStrangerComments: boolean;
  }
  const fetchedA = listData.posts.find((p: TestPost) => p.id === postsCreated["A"]);
  const fetchedB = listData.posts.find((p: TestPost) => p.id === postsCreated["B"]);
  const fetchedC = listData.posts.find((p: TestPost) => p.id === postsCreated["C"]);

  if (!fetchedA || fetchedA.allowComments !== true || fetchedA.allowStrangerComments !== true) {
    throw new Error("GET /api/posts: Post A properties missing or incorrect: " + JSON.stringify(fetchedA));
  }
  if (!fetchedB || fetchedB.allowComments !== false || fetchedB.allowStrangerComments !== true) {
    throw new Error("GET /api/posts: Post B properties missing or incorrect: " + JSON.stringify(fetchedB));
  }
  if (!fetchedC || fetchedC.allowComments !== true || fetchedC.allowStrangerComments !== false) {
    throw new Error("GET /api/posts: Post C properties missing or incorrect: " + JSON.stringify(fetchedC));
  }
  console.log("✓ GET /api/posts includes correct privacy fields");

  console.log("Fetching GET /api/posts/[id] for Post B...");
  const detailB = await getPostDetail(postsCreated["B"]);
  if (detailB.post.allowComments !== false || detailB.post.allowStrangerComments !== true) {
    throw new Error("GET /api/posts/[id]: Post B properties incorrect: " + JSON.stringify(detailB.post));
  }
  console.log("✓ GET /api/posts/[id] includes correct privacy fields");

  // 4. Test Comment Rules Enforcement
  console.log("\n--- Testing Comments Privacy Enforcement ---");

  // Post A (allowComments=true, allowStrangerComments=true)
  console.log("\nTesting Post A (Open comments):");
  console.log("Adding comment as Guest...");
  const cAGuest = await createComment(postsCreated["A"], "Guest comment on A");
  if (cAGuest.status !== 201) {
    throw new Error(`Guest comment on Post A failed. Expected 201, got ${cAGuest.status}: ${JSON.stringify(cAGuest.data)}`);
  }
  console.log("✓ Guest comment on Post A succeeded (201)");

  console.log("Adding comment as User...");
  const cAUser = await createComment(postsCreated["A"], "User comment on A", userCookie);
  if (cAUser.status !== 201) {
    throw new Error(`User comment on Post A failed. Expected 201, got ${cAUser.status}: ${JSON.stringify(cAUser.data)}`);
  }
  console.log("✓ User comment on Post A succeeded (201)");

  // Post B (allowComments=false)
  console.log("\nTesting Post B (Comments disabled):");
  console.log("Adding comment as Guest...");
  const cBGuest = await createComment(postsCreated["B"], "Guest comment on B");
  if (cBGuest.status !== 403) {
    throw new Error(`Guest comment on Post B did not block. Expected 403, got ${cBGuest.status}: ${JSON.stringify(cBGuest.data)}`);
  }
  console.log("✓ Guest comment on Post B blocked (403)");

  console.log("Adding comment as User...");
  const cBUser = await createComment(postsCreated["B"], "User comment on B", userCookie);
  if (cBUser.status !== 403) {
    throw new Error(`User comment on Post B did not block. Expected 403, got ${cBUser.status}: ${JSON.stringify(cBUser.data)}`);
  }
  console.log("✓ User comment on Post B blocked (403)");

  // Post C (allowStrangerComments=false)
  console.log("\nTesting Post C (No stranger comments):");
  console.log("Adding comment as Guest...");
  const cCGuest = await createComment(postsCreated["C"], "Guest comment on C");
  if (cCGuest.status !== 403) {
    throw new Error(`Guest comment on Post C did not block. Expected 403, got ${cCGuest.status}: ${JSON.stringify(cCGuest.data)}`);
  }
  console.log("✓ Guest comment on Post C blocked (403)");

  console.log("Adding comment as User...");
  const cCUser = await createComment(postsCreated["C"], "User comment on C", userCookie);
  if (cCUser.status !== 201) {
    throw new Error(`User comment on Post C failed. Expected 201, got ${cCUser.status}: ${JSON.stringify(cCUser.data)}`);
  }
  console.log("✓ User comment on Post C succeeded (201)");

  // 5. Cleanup
  console.log("\nCleaning up test posts/comments...");
  await prisma.comment.deleteMany({
    where: { postId: { in: Object.values(postsCreated) } },
  });
  await prisma.post.deleteMany({
    where: { id: { in: Object.values(postsCreated) } },
  });
  await prisma.user.delete({
    where: { id: testUser.id },
  });

  console.log("\n=== All Privacy Toggles Verification Tests Passed! ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
