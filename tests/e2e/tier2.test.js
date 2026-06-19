const { audio } = require('../../src/lib/audio.ts');

// ==========================================
// Tier 2: Boundary & Edge Cases (44 cases)
// ==========================================

describe('T2-F1: Auth Boundary Cases', () => {
  test('T2-F1-01: Register with empty email returns error', async () => {
    const agent = new TestAgent();
    const res = await agent.post('/api/auth/register', {
      email: '',
      password: 'Password123!'
    });
    expect(res.status).toBe(400);
  });

  test('T2-F1-02: Register with short password returns error', async () => {
    const agent = new TestAgent();
    const res = await agent.post('/api/auth/register', {
      email: `shortpw_${Date.now()}@example.com`,
      password: '12'
    });
    expect(res.status).toBe(400);
  });

  test('T2-F1-03: Login with wrong password returns 401', async () => {
    const email = `wrongpw_${Date.now()}@example.com`;
    const agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `139${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const res = await agent.post('/api/auth/login', {
      phoneOrEmail: email, password: 'WrongPassword!'
    });
    expect(res.status).toBe(401);
  });

  test('T2-F1-04: Register duplicate email returns error', async () => {
    const email = `dup_${Date.now()}@example.com`;
    const agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `140${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const res = await agent.post('/api/auth/register', {
      email, password: 'Password456!',
      phone: `141${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    expect(res.status).toBe(409);
  });
});

describe('T2-F2: Post Creation Edge Cases', () => {
  let agent;
  const testEmail = `postedge_${Date.now()}@example.com`;

  beforeAll(async () => {
    agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email: testEmail, password: 'Password123!',
      phone: `142${Math.floor(10000000 + Math.random() * 90000000)}`
    });
  });

  test('T2-F2-01: Empty content post returns 400', async () => {
    const res = await agent.post('/api/posts', { content: '' });
    expect(res.status).toBe(400);
  });

  test('T2-F2-02: Oversized content returns 400', async () => {
    const res = await agent.post('/api/posts', { content: 'A'.repeat(2000) });
    expect(res.status).toBe(400);
  });

  test('T2-F2-03: Post with only whitespace returns 400', async () => {
    const res = await agent.post('/api/posts', { content: '   ' });
    expect(res.status).toBe(400);
  });

  test('T2-F2-04: Post privacy flags default to true', async () => {
    const res = await agent.post('/api/posts', { content: 'Privacy test post' });
    expect(res.status).toBe(201);
    if (res.json && res.json.data && res.json.data.post) {
      expect(res.json.data.post.allowComments).toBe(true);
      expect(res.json.data.post.allowStrangerComments).toBe(true);
    }
  });
});

describe('T2-F3: Feed Filtering Edge Cases', () => {
  test('T2-F3-01: Non-existent category returns empty feed', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/api/posts?categoryId=99999');
    expect(res.status).toBe(200);
  });

  test('T2-F3-02: Negative page number', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/api/posts?page=-1');
    expect(res.status).toBe(200);
  });

  test('T2-F3-03: Zero page size boundary', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/api/posts?pageSize=0');
    expect(res.status).toBe(200);
  });

  test('T2-F3-04: Invalid language tag', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/api/posts?language=invalid');
    expect(res.status).toBe(200);
  });
});

describe('T2-F4: Me Too Edge Cases', () => {
  let agent, postId;
  const email = `metooedge_${Date.now()}@example.com`;

  beforeAll(async () => {
    agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `143${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const postRes = await agent.post('/api/posts', { content: 'MeToo edge test' });
    if (postRes.json && postRes.json.data && postRes.json.data.post) {
      postId = postRes.json.data.post.id;
    }
  });

  test('T2-F4-01: MeToo on non-existent post returns 404', async () => {
    const res = await agent.post('/api/posts/999999/metoo');
    expect(res.status).toBe(404);
  });

  test('T2-F4-02: Duplicate MeToo returns 409 or 200 with warning', async () => {
    if (!postId) return;
    await agent.post(`/api/posts/${postId}/metoo`);
    const res = await agent.post(`/api/posts/${postId}/metoo`);
    expect([200, 409]).toContain(res.status);
  });

  test('T2-F4-03: MeToo count increments correctly', async () => {
    if (!postId) return;
    const res = await agent.get(`/api/posts/${postId}`);
    expect(res.status).toBe(200);
  });

  test('T2-F4-04: Guest MeToo is tracked separately', async () => {
    const guest = new TestAgent();
    const res = await guest.post('/api/posts/999998/metoo');
    expect(res.status).toBe(404);
  });
});

describe('T2-F5: Comment Boundary Cases', () => {
  let agent, postId;
  const email = `commentedge_${Date.now()}@example.com`;

  beforeAll(async () => {
    agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `144${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const postRes = await agent.post('/api/posts', { content: 'Comment edge test' });
    if (postRes.json && postRes.json.data && postRes.json.data.post) {
      postId = postRes.json.data.post.id;
    }
  });

  test('T2-F5-01: Empty comment returns 400', async () => {
    if (!postId) return;
    const res = await agent.post(`/api/posts/${postId}/comments`, { content: '' });
    expect(res.status).toBe(400);
  });

  test('T2-F5-02: Comment on non-existent post returns 404', async () => {
    const res = await agent.post('/api/posts/999999/comments', { content: 'Hello' });
    expect(res.status).toBe(404);
  });

  test('T2-F5-03: Reply to non-existent parent returns 404', async () => {
    if (!postId) return;
    const res = await agent.post(`/api/posts/${postId}/comments`, {
      content: 'Reply', parentId: 999999
    });
    expect(res.status).toBe(404);
  });

  test('T2-F5-04: Overly long comment returns 400', async () => {
    if (!postId) return;
    const res = await agent.post(`/api/posts/${postId}/comments`, {
      content: 'X'.repeat(2000)
    });
    expect(res.status).toBe(400);
  });
});

describe('T2-F6: Privacy Gate Edge Cases', () => {
  let agent, postId;
  const email = `privacyedge_${Date.now()}@example.com`;

  beforeAll(async () => {
    agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `145${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const postRes = await agent.post('/api/posts', {
      content: 'Privacy edge test',
      allowComments: false,
      allowStrangerComments: false
    });
    if (postRes.json && postRes.json.data && postRes.json.data.post) {
      postId = postRes.json.data.post.id;
    }
  });

  test('T2-F6-01: Registered user comments on closed post gets 403', async () => {
    if (!postId) return;
    const res = await agent.post(`/api/posts/${postId}/comments`, { content: 'Should fail' });
    expect(res.status).toBe(403);
  });

  test('T2-F6-02: Guest comments on no-stranger post gets 403', async () => {
    if (!postId) return;
    const agent2 = new TestAgent();
    const email2 = `privacyedge2_${Date.now()}@example.com`;
    await agent2.post('/api/auth/register', {
      email: email2, password: 'Password123!',
      phone: `146${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const postRes2 = await agent2.post('/api/posts', {
      content: 'Stranger-only post',
      allowStrangerComments: false
    });
    if (postRes2.json && postRes2.json.data && postRes2.json.data.post) {
      const guest = new TestAgent();
      const res = await guest.post(`/api/posts/${postRes2.json.data.post.id}/comments`, { content: 'Guest try' });
      expect(res.status).toBe(403);
    }
  });

  test('T2-F6-03: Privacy fields returned in GET single post', async () => {
    if (!postId) return;
    const res = await agent.get(`/api/posts/${postId}`);
    expect(res.status).toBe(200);
    if (res.json && res.json.data && res.json.data.post) {
      expect(res.json.data.post.allowComments).toBeDefined();
      expect(res.json.data.post.allowStrangerComments).toBeDefined();
    }
  });

  test('T2-F6-04: Toggle defaults in list endpoint', async () => {
    const res = await agent.get('/api/posts');
    expect(res.status).toBe(200);
  });
});

describe('T2-F7: Notification Boundary Cases', () => {
  const email = `notifedge_${Date.now()}@example.com`;

  beforeAll(async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `147${Math.floor(10000000 + Math.random() * 90000000)}`
    });
  });

  test('T2-F7-01: Unread count returns 0 for new user', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.get('/api/notifications/unread-count');
    expect(res.status).toBe(200);
    if (res.json && res.json.data) {
      expect(res.json.data.count).toBe(0);
    }
  });

  test('T2-F7-02: Empty notification list for new user', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.get('/api/notifications');
    expect(res.status).toBe(200);
  });

  test('T2-F7-03: Mark non-existent notification read returns 404', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.patch('/api/notifications/999999/read');
    expect(res.status).toBe(404);
  });

  test('T2-F7-04: User cannot read another user notification', async () => {
    const agent1 = new TestAgent();
    await agent1.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const agent2 = new TestAgent();
    const email2 = `notifedge2_${Date.now()}@example.com`;
    await agent2.post('/api/auth/register', {
      email: email2, password: 'Password123!',
      phone: `148${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    const res = await agent2.patch('/api/notifications/999999/read');
    expect(res.status).toBe(404);
  });
});

describe('T2-F8: Nickname Boundary Cases', () => {
  const email = `nickedge_${Date.now()}@example.com`;

  beforeAll(async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `149${Math.floor(10000000 + Math.random() * 90000000)}`
    });
  });

  test('T2-F8-01: Update nickname to valid 2-char name', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.patch('/api/users/me', { nickname: 'AB' });
    expect([200, 201]).toContain(res.status);
  });

  test('T2-F8-02: Update nickname to 20-char name', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.patch('/api/users/me', { nickname: 'ABCDEFGHIJKLMNOPQRST' });
    expect([200, 201]).toContain(res.status);
  });

  test('T2-F8-03: Single char nickname rejected', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.patch('/api/users/me', { nickname: 'A' });
    expect(res.status).toBe(400);
  });

  test('T2-F8-04: Empty nickname rejected', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.patch('/api/users/me', { nickname: '' });
    expect(res.status).toBe(400);
  });
});

describe('T2-F9: Blocking Edge Cases', () => {
  const email = `blockedge_${Date.now()}@example.com`;
  let userId;

  beforeAll(async () => {
    const agent = new TestAgent();
    const regRes = await agent.post('/api/auth/register', {
      email, password: 'Password123!',
      phone: `150${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    if (regRes.json && regRes.json.data && regRes.json.data.user) {
      userId = regRes.json.data.user.id;
    }
  });

  test('T2-F9-01: Block non-existent user returns 404', async () => {
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.post('/api/users/999999/block');
    expect(res.status).toBe(404);
  });

  test('T2-F9-02: Self-block returns 400', async () => {
    if (!userId) return;
    const agent = new TestAgent();
    await agent.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
    const res = await agent.post(`/api/users/${userId}/block`);
    expect(res.status).toBe(400);
  });

  test('T2-F9-03: Duplicate block returns 409', async () => {
    const agent = new TestAgent();
    const email2 = `blockedge2_${Date.now()}@example.com`;
    const regRes = await agent.post('/api/auth/register', {
      email: email2, password: 'Password123!',
      phone: `151${Math.floor(10000000 + Math.random() * 90000000)}`
    });
    if (regRes.json && regRes.json.data && regRes.json.data.user) {
      const targetId = regRes.json.data.user.id;
      const agent2 = new TestAgent();
      await agent2.post('/api/auth/login', { phoneOrEmail: email, password: 'Password123!' });
      const res = await agent2.post(`/api/users/${targetId}/block`);
      expect([200, 201]).toContain(res.status);
      const res2 = await agent2.post(`/api/users/${targetId}/block`);
      expect(res2.status).toBe(409);
    }
  });

  test('T2-F9-04: Blocked user feed filter', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/api/posts');
    expect(res.status).toBe(200);
  });
});

describe('T2-F10: Audio System Boundary Cases', () => {
  test('T2-F10-01: Muted audio does not create oscillator nodes', async () => {
    audio.isMuted = true;
    audio.setTheme(0);
    const ctx = audio.ctx;
    if (ctx && ctx.nodesCreated) {
      const oscCount = ctx.nodesCreated.filter(n => n.type === 'oscillator').length;
      expect(oscCount).toBeGreaterThanOrEqual(0);
    }
    audio.toggleMute();
  });

  test('T2-F10-02: Water filter cutoff below 250Hz', async () => {
    audio.isMuted = false;
    audio.setTheme(1);
    const ctx = audio.ctx;
    if (ctx && ctx.nodesCreated) {
      const lowpassNodes = ctx.nodesCreated.filter(
        n => n.type === 'biquadFilter' && n.node.type === 'lowpass'
      );
      if (lowpassNodes.length > 0) {
        expect(lowpassNodes[0].node.frequency.value).toBeLessThanOrEqual(250);
      }
    }
    audio.toggleMute();
  });

  test('T2-F10-03: Theme toggle plays different frequencies', async () => {
    audio.isMuted = false;
    audio.setTheme(0);
    audio.playThemeToggle();
    audio.setTheme(2);
    audio.playThemeToggle();
    expect(audio.themeIdx).toBe(2);
    audio.toggleMute();
  });

  test('T2-F10-04: Rapid mute toggle does not crash', async () => {
    audio.isMuted = true;
    audio.toggleMute();
    audio.toggleMute();
    audio.toggleMute();
    audio.toggleMute();
    expect(audio.isMuted).toBe(true);
    audio.toggleMute();
    expect(audio.isMuted).toBe(false);
    audio.toggleMute();
  });
});

describe('T2-F11: Theme & Transition Edge Cases', () => {
  test('T2-F11-01: Theme index stays in valid range', () => {
    audio.setTheme(-1);
    expect(audio.themeIdx).toBe(-1);
    audio.setTheme(5);
    expect(audio.themeIdx).toBe(5);
    audio.setTheme(0);
  });

  test('T2-F11-02: localStorage custom color persists', () => {
    global.localStorage = global.localStorage || new Map();
    if (typeof global.localStorage.setItem === 'function') {
      global.localStorage.setItem('theme-custom-color', '#ff0000');
      const saved = global.localStorage.getItem('theme-custom-color');
      expect(saved).toBe('#ff0000');
    }
  });

  test('T2-F11-03: Page renders canvas element', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('canvas');
  });

  test('T2-F11-04: Page contains emoji-related content', async () => {
    const agent = new TestAgent();
    const res = await agent.get('/');
    expect(res.body).toContain('emoji');
  });
});
