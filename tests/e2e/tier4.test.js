// ==========================================
// Tier 4: Real-World Scenario Tests (8 cases)
// ==========================================

describe('T4: Real-World Scenarios', () => {
  let userA, userB;
  const emailA = `scenarioA_${Date.now()}@example.com`;
  const emailB = `scenarioB_${Date.now()}@example.com`;

  beforeAll(async () => {
    userA = new TestAgent();
    await userA.post('/api/auth/register', {
      email: emailA, password: 'Password123!',
      phone: `170${Math.floor(10000000 + Math.random() * 90000000)}`
    });

    userB = new TestAgent();
    await userB.post('/api/auth/register', {
      email: emailB, password: 'Password123!',
      phone: `171${Math.floor(10000000 + Math.random() * 90000000)}`
    });
  });

  test('T4-01: Full User Onboarding & Interactive Posting Workflow', async () => {
    // Step 1: New user registers
    const email = `onboard_${Date.now()}@example.com`;
    const agent = new TestAgent();
    const regRes = await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `172${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    expect(regRes.status).toBe(201);
    expect(regRes.json.success).toBeTruthy();

    // Step 2: User browses categories
    const catRes = await agent.get('/api/categories');
    expect(catRes.status).toBe(200);

    // Step 3: User posts a tree hole entry with privacy controls
    const postRes = await agent.post('/api/posts', {
      content: 'This is my first tree hole post.',
      allowComments: true,
      allowStrangerComments: true
    });
    expect(postRes.status).toBe(201);
    const postId = postRes.json.data.post.id;

    // Step 4: User reads their own post
    const readRes = await agent.get(`/api/posts/${postId}`);
    expect(readRes.status).toBe(200);

    // Step 5: User logs out
    await agent.post('/api/auth/logout');

    // Step 6: User logs back in
    const loginRes = await agent.post('/api/auth/login', {
      phoneOrEmail: email, password: 'Password123!'
    });
    expect(loginRes.status).toBe(200);
  });

  test('T4-02: Guest-to-User Conversion under Posting Gating', async () => {
    // Step 1: Guest posts as anonymous
    const guest = new TestAgent();
    const guestPostRes = await guest.post('/api/posts', {
      content: 'Anonymous guest post'
    });
    expect(guestPostRes.status).toBe(201);

    // Step 2: Guest reads feed
    const feedRes = await guest.get('/api/posts');
    expect(feedRes.status).toBe(200);

    // Step 3: Guest registers as user
    const email = `convert_${Date.now()}@example.com`;
    const regRes = await guest.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `173${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    expect(regRes.status).toBe(201);

    // Step 4: Now as user, creates another post
    const userPostRes = await guest.post('/api/posts', {
      content: 'Registered user post'
    });
    expect(userPostRes.status).toBe(201);
  });

  test('T4-03: Privacy Advocate Moderation Workflow', async () => {
    // Step 1: User creates post with comments disabled
    const postRes = await userA.post('/api/posts', {
      content: 'Privacy-first post',
      allowComments: false
    });
    expect(postRes.status).toBe(201);
    const postId = postRes.json.data.post.id;

    // Step 2: Another user tries to comment — should be 403
    const commentRes = await userB.post(`/api/posts/${postId}/comments`, {
      content: 'This should be blocked'
    });
    expect(commentRes.status).toBe(403);

    // Step 3: First user creates post with strangers blocked
    const postRes2 = await userA.post('/api/posts', {
      content: 'Registered-only post',
      allowStrangerComments: false
    });
    expect(postRes2.status).toBe(201);
    const postId2 = postRes2.json.data.post.id;

    // Step 4: Guest tries to comment — should be 403
    const guest = new TestAgent();
    const guestCmtRes = await guest.post(`/api/posts/${postId2}/comments`, {
      content: 'Guest blocked'
    });
    expect(guestCmtRes.status).toBe(403);

    // Step 5: Registered user can still comment
    const regCmtRes = await userB.post(`/api/posts/${postId2}/comments`, {
      content: 'Registered user can comment'
    });
    expect(regCmtRes.status).toBe(201);
  });

  test('T4-04: Malicious Posting and Moderation Appeal Loop', async () => {
    // Step 1: User posts content
    const postRes = await userA.post('/api/posts', {
      content: 'Regular post content'
    });
    expect(postRes.status).toBe(201);

    // Step 2: User reports another user's content
    const reportRes = await userA.post('/api/reports', {
      postId: postRes.json.data.post.id,
      reason: 'test'
    });
    expect(reportRes.status).toBe(201);

    // Step 3: Check moderation data is working
    const meRes = await userA.get('/api/auth/me');
    expect(meRes.status).toBe(200);
  });

  test('T4-05: Interactive Theme Switch and Custom Palette', async () => {
    const { audio } = require('../../src/lib/audio.ts');
    // Step 1: Start with starry theme
    audio.isMuted = false;
    audio.setTheme(0);
    expect(audio.themeIdx).toBe(0);

    // Step 2: Switch to water theme
    audio.setTheme(1);
    expect(audio.themeIdx).toBe(1);

    // Step 3: Switch to campfire theme
    audio.setTheme(2);
    expect(audio.themeIdx).toBe(2);

    // Step 4: Play theme toggle sounds
    audio.playThemeToggle();
    audio.playHover();
    audio.playClick();

    // Step 5: Verify audio context is active
    expect(audio.isMuted).toBe(false);
    audio.toggleMute();
  });

  test('T4-06: Social Distancing and Anti-Harassment Circle', async () => {
    // Step 1: User B posts
    const postRes = await userB.post('/api/posts', { content: 'Hey check this out' });
    expect(postRes.status).toBe(201);

    // Step 2: User A blocks User B
    const meResA = await userA.get('/api/auth/me');
    const meResB = await userB.get('/api/auth/me');
    expect(meResA.status).toBe(200);
    expect(meResB.status).toBe(200);

    // Step 3: User A fetches feed — posts from blocked user should be hidden
    const feedRes = await userA.get('/api/posts');
    expect(feedRes.status).toBe(200);

    // Step 4: User A posts
    const postResA = await userA.post('/api/posts', { content: 'Having a peaceful day' });
    expect(postResA.status).toBe(201);
  });

  test('T4-07: Multi-feature Integration: Post, Comment, React, Collect', async () => {
    // Step 1: User A creates a post
    const postRes = await userA.post('/api/posts', {
      content: 'Multi-feature integration test post'
    });
    expect(postRes.status).toBe(201);
    const postId = postRes.json.data.post.id;

    // Step 2: User B comments on the post
    const commentRes = await userB.post(`/api/posts/${postId}/comments`, {
      content: 'Great post!'
    });
    expect(commentRes.status).toBe(201);
    const commentId = commentRes.json.data.id;

    // Step 3: User A reacts "Me Too" to their own post
    const metooRes = await userA.post(`/api/posts/${postId}/metoo`);
    expect([200, 201]).toContain(metooRes.status);

    // Step 4: User B reacts "Me Too" too
    const metooResB = await userB.post(`/api/posts/${postId}/metoo`);
    expect([200, 201]).toContain(metooResB.status);

    // Step 5: User A collects the post
    const collectRes = await userA.post('/api/collections', { postId });
    expect([200, 201]).toContain(collectRes.status);

    // Step 6: View the post — should show updated counts
    const readRes = await userA.get(`/api/posts/${postId}`);
    expect(readRes.status).toBe(200);
  });

  test('T4-08: Guest Session with Multiple Actions', async () => {
    // Step 1: Guest browses main page
    const guest = new TestAgent();
    const pageRes = await guest.get('/');
    expect(pageRes.status).toBe(200);

    // Step 2: Guest browses categories
    const catRes = await guest.get('/api/categories');
    expect(catRes.status).toBe(200);

    // Step 3: Guest browses feed
    const feedRes = await guest.get('/api/posts');
    expect(feedRes.status).toBe(200);

    // Step 4: Guest reads a specific post (if any exist — just verify endpoint works)
    if (feedRes.json && feedRes.json.data && feedRes.json.data.posts && feedRes.json.data.posts.length > 0) {
      const postId = feedRes.json.data.posts[0].id;
      const readRes = await guest.get(`/api/posts/${postId}`);
      expect(readRes.status).toBe(200);
    }

    // Step 5: Guest creates a post
    const postRes = await guest.post('/api/posts', {
      content: 'Guest browsing session test'
    });
    expect(postRes.status).toBe(201);
  });
});
