# Lumin E2E Testing Infrastructure & Test Suite Strategy

This report provides a comprehensive analysis of the existing codebase at `E:\Desktop\Lumin`, recommends an offline-friendly E2E testing architecture, outlines verification methods for visual/audio features (R3), and lists 127 E2E test cases across Tiers 1-4 for features F1-F11.

---

## 1. Codebase Analysis: Feature Status (R1, R2, R3)

We analyzed the current codebase to trace the implementation and planning of the target features:

### R1: Post Comments Privacy Controls & DB Schema
* **Prisma Schema (`prisma/schema.prisma`)**: The database schema has already been updated. The `Post` model (lines 69-70) contains:
  ```prisma
  allowComments    Boolean   @default(true)
  allowStrangerComments Boolean @default(true)
  ```
* **REST API Endpoints**:
  * `POST /api/posts` (`src/app/api/posts/route.ts`): Currently does **not** extract `allowComments` or `allowStrangerComments` from the request JSON body, and does **not** pass them to `prisma.post.create`.
  * `GET /api/posts` (`src/app/api/posts/route.ts`) & `GET /api/posts/[id]` (`src/app/api/posts/[id]/route.ts`): Currently do **not** return these fields in their mapped success payloads.
  * `POST /api/posts/[id]/comments` (`src/app/api/posts/[id]/comments/route.ts`): Currently does **not** check these fields before allowing comments.
* **Status**: **Planned / In Progress**. The schema additions are in place, but the API routing validation and serialization logic must be implemented.

### R2: Social & User Features
* **Nickname Updates**: The endpoint `PATCH /api/users/me` (`src/app/api/users/me/route.ts`) is fully implemented. It accepts `nickname`, `bio`, `birthday`, `status`, and `backgroundUrl`. It enforces nickname length limits (2-20 characters), bio limits (200 characters), and runs content moderation.
* **Nickname Alignment**: When a post is created, the nickname is saved to the `Post` record itself (`nickname: user?.nickname || guestNickname`). Subsequent updates to the user's nickname **do not** automatically sync to old posts.
* **Emoji Picker / Quick Entry**: Not yet implemented. Planned for the frontend input panels in `src/app/page.tsx`.
* **Message Box / Notifications Feed**: The backend notification API endpoints (e.g. `/api/notifications`, `/api/notifications/[id]/read`) are fully implemented and support unread counts. However, the frontend UI components to display these notifications in a message box are planned.
* **"My Posts" View**: The backend allows filtering posts by `userId` (via query params), but the frontend UI view in `src/app/page.tsx` is planned.
* **Status**: **Partially Implemented**. The backend is mostly ready, but frontend UI elements and dynamic nickname propagation (if desired) are planned.

### R3: Sensory & Visual Aesthetics
* **Web Audio Soundscapes (`src/lib/audio.ts`)**: An `AudioManager` class is fully implemented and exported. It generates complex sounds using oscillators, gain nodes, and biquad filters:
  * *Starry Sky*: low-frequency drone (65-68Hz) and crystal shimmers (2000-4000Hz).
  * *Water Theme*: Lowpass-filtered white noise (400Hz cutoff) modulated by an LFO (0.3Hz) to simulate waves, plus bandpass-filtered noise for a distant campfire.
  * *Campfire Theme*: Pink noise rumble (600Hz cutoff) modulated by an LFO (0.2Hz), crackle noise (bandpass at 5000Hz), and random pops (random intervals, triangle waves).
* **Ambient Noise Reduction & Campfire Enhancement**: The audio manager is written, but tuning parameters to reduce water hiss and boost campfire pops are planned.
* **Musical Note Triggers**: Hovering, clicking, posting, and Me-Too actions play distinct synthesized sounds. Theme toggling plays a sweep note (150Hz to 250Hz and back). Further distinct theme-specific notes are planned.
* **Canvas Water Ripple Transition & Theme Color Picker**: The page uses HTML5 Canvas for the starry treehole layout, but the full-screen canvas/CSS water ripple transition and custom color pickers are planned.
* **Status**: **Core Audio Engine Implemented / Sensory Toggles Planned**. The audio backend is functional; visual transitions, color pickers, and specific note tweaks are planned.

---

## 2. Recommended E2E Testing Architecture (Offline Environment)

Since the project operates in a strictly offline environment (`CODE_ONLY` network mode) without access to external npm repositories or Microsoft CDN for Playwright browser binaries, **Playwright cannot be run**.

### Proposed Architecture: Custom Node-based Integration & DOM Simulator Runner
We recommend establishing a custom, lightweight E2E test runner under `tests/e2e/runner.js` that executes against a running local Next.js server (`http://localhost:3000`).

#### 1. Setup and Server Orchestration
* The runner will spawn `npm run dev` as a background process using Node's `child_process.spawn`.
* It polls the health check endpoint (e.g., `http://localhost:3000/api/debug-env` or `/`) until it returns status `200`.
* Before each test run (or suite), the database is reset to a clean state by running `npx prisma db push` or restoring a clean SQLite file (`prisma/dev.db`).

#### 2. Session & HTTP Client Agent
A simple request client is implemented to maintain cookie state across requests:
```javascript
class TestAgent {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.cookies = '';
  }
  async request(path, options = {}) {
    const headers = { ...options.headers };
    if (this.cookies) headers['Cookie'] = this.cookies;
    const response = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookies = setCookie; // Maintain session token
    return response;
  }
}
```

#### 3. DOM & Page Selector Simulation
Since `jsdom` cannot be downloaded offline, the runner parses server-rendered HTML using regular expressions or a lightweight parser:
```javascript
function querySelector(html, selector) {
  // Simulates finding elements by id or class
  if (selector.startsWith('#')) {
    const id = selector.substring(1);
    const regex = new RegExp(`id=["']${id}["'][^>]*>([^<]*)`, 'i');
    const match = html.match(regex);
    return match ? { textContent: match[1].trim() } : null;
  }
  // Fallback string matching for buttons, fields
  return html.includes(selector) ? {} : null;
}
```

#### 4. Execution & Reporting
* The runner executes tests in files under `tests/e2e/**/*.test.js`.
* It provides `describe()`, `test()`, and assertions `expect()`.
* It catches errors, records statistics, terminates the background dev server, and exits with code `0` (success) or `1` (failure).

---

## 3. R3 Sensory Feature Testing Strategy

Testing Web Audio, Canvas rendering, and CSS transitions in a headless, offline command-line environment requires mock interfaces and static code validation:

### A. Testing Web Audio Synthesis & Note Triggers
Since there is no physical speaker, we inject a mock `AudioContext` on `globalThis` before executing the audio code:
1. **Mock Definition**: Mock `AudioContext`, `GainNode`, `OscillatorNode`, `BiquadFilterNode`, `ConvolverNode`, and `AudioBuffer`.
2. **Connection Recording**: The mocked nodes record their connections and property updates (e.g. `setValueAtTime`, `setTargetAtTime`).
3. **Assertions**:
   * **Ambient Noise Reduction**: Assert that when Water theme is selected, the `BiquadFilterNode` is created with type `lowpass` and frequency value set to `400` Hz.
   * **Campfire Enhancement**: Assert that Campfire theme creates `PinkNoise` (using the Kellet formula) and a `bandpass` filter with frequency `5000` Hz and `Q = 1.5`.
   * **Theme Switch Notes**: Assert that switching to Starry theme creates an oscillator that plays notes C5 (`523.25` Hz) or E5 (`659.25` Hz).

### B. Testing Canvas & CSS Water Ripple Transition
1. **HTML Inspection**: Fetch `/` and assert that the `<canvas>` element exists.
2. **Transition Trigger State**: Trigger the transition action. Assert that state variables `st.isTransitioning` or `st.rippleActive` are set to `true`.
3. **Canvas Drawing Verification**: Mock `HTMLCanvasElement.prototype.getContext('2d')`. Assert that when transition starts, the canvas drawing methods (`clearRect`, `arc`, `stroke`) are called repeatedly via `requestAnimationFrame` with increasing radius values.
4. **CSS Assertion**: Verify that the document root or transition container gains the class `.ripple-active`.

### C. Testing Theme Color Picker
1. **Palette Rendering**: Verify that the theme configuration component displays input elements with predefined hex colors (e.g., `#FF7F50` for campfire).
2. **Local Storage Persistence**: Simulate a color change event. Assert that the selected colors are written to `localStorage.setItem('custom-theme-colors', ...)`.
3. **CSS Variables Insertion**: Refresh the client mock environment and assert that the CSS custom properties (like `--primary-color` or `--bg-color`) are set on the document element matching the persisted values.

---

## 4. Draft E2E Test Cases: Features F1-F11 (127 Total)

The test cases are divided into 4 Tiers:
* **Tier 1**: Happy Path / Feature Coverage (44 Cases)
* **Tier 2**: Boundary & Edge Cases (44 Cases)
* **Tier 3**: Cross-Feature Interactions (31 Cases)
* **Tier 4**: Real-World Scenarios / Workloads (8 Cases)

Features mapping:
* **F1**: User Authentication & Registration
* **F2**: User Profile & Personalization
* **F3**: Post Creation & Publishing
* **F4**: Post Feed & Discovery
* **F5**: Post Interactions (Like & Me Too)
* **F6**: Commenting & Threading
* **F7**: Post Privacy Controls (R1)
* **F8**: Time Capsules & Scheduling
* **F9**: Content Moderation & Banning
* **F10**: User Appeals & Feedback
* **F11**: Notifications, Collections & Blocks

---

### Tier 1: Happy Path & Feature Coverage (44 Test Cases)

| Test ID | Feature | Description | Action | Expected Result |
|---|---|---|---|---|
| **TC-T1-F1-01** | F1 Auth | User registration | POST `/api/auth/register` with unique email/password | Returns 201; user created successfully |
| **TC-T1-F1-02** | F1 Auth | User login | POST `/api/auth/login` with correct credentials | Returns 200; sets `th_token` cookie |
| **TC-T1-F1-03** | F1 Auth | User logout | POST `/api/auth/logout` with active session | Returns 200; clears `th_token` cookie |
| **TC-T1-F1-04** | F1 Auth | Fetch active user profile | GET `/api/auth/me` with active session | Returns 200; returns correct user profile details |
| **TC-T1-F2-01** | F2 Profile | Update user nickname | PATCH `/api/users/me` with new valid nickname | Returns 200; user profile nickname updated |
| **TC-T1-F2-02** | F2 Profile | Update bio | PATCH `/api/users/me` with new valid bio string | Returns 200; bio updated in database |
| **TC-T1-F2-03** | F2 Profile | Update birthday and zodiac | PATCH `/api/users/me` with date string | Returns 200; calculates correct zodiac in response |
| **TC-T1-F2-04** | F2 Profile | Update background image | PATCH `/api/users/me` with valid background URL | Returns 200; background URL persisted |
| **TC-T1-F3-01** | F3 Posting | Create standard user post | POST `/api/posts` with valid text content | Returns 201; post saved with user ID & nickname |
| **TC-T1-F3-02** | F3 Posting | Create guest post | POST `/api/posts` without session cookie | Returns 201; post saved with guest nickname |
| **TC-T1-F3-03** | F3 Posting | Auto-classify category | POST `/api/posts` with content containing category keyword | Returns 201; automatically assigns correct category ID |
| **TC-T1-F3-04** | F3 Posting | Encrypt post content | POST `/api/posts` with text content | Returns 201; checks DB to confirm content is encrypted |
| **TC-T1-F4-01** | F4 Discovery | Fetch posts feed | GET `/api/posts` with pagination parameters | Returns 200; list of posts with decrypted content |
| **TC-T1-F4-02** | F4 Discovery | Fetch single post details | GET `/api/posts/[id]` with valid post ID | Returns 200; returns correct post details |
| **TC-T1-F4-03** | F4 Discovery | Filter posts by category | GET `/api/posts?categoryId=X` | Returns 200; only posts of category X are returned |
| **TC-T1-F4-04** | F4 Discovery | Filter posts by tag | GET `/api/posts?tag=Y` | Returns 200; only posts with tag Y are returned |
| **TC-T1-F5-01** | F5 Interaction | Like a post | POST `/api/posts/[id]/like` from new IP | Returns 200; like count incremented |
| **TC-T1-F5-02** | F5 Interaction | Me-Too a post | POST `/api/posts/[id]/metoo` with user session | Returns 200; me-too count incremented |
| **TC-T1-F5-03** | F5 Interaction | Me-Too tier assignment | Fetch post after 10 Me-Toos | Returns 200; post details show correct Me-Too tier |
| **TC-T1-F5-04** | F5 Interaction | Remove Like | POST `/api/posts/[id]/like` again from same IP | Returns 200; like removed and count decremented |
| **TC-T1-F6-01** | F6 Comments | Create comment on post | POST `/api/posts/[id]/comments` with text content | Returns 201; comment added with author nickname |
| **TC-T1-F6-02** | F6 Comments | Create reply to comment | POST `/api/posts/[id]/comments` with valid parentId | Returns 201; reply linked to parent comment |
| **TC-T1-F6-03** | F6 Comments | Fetch comments list | GET `/api/posts/[id]/comments` | Returns 200; list of comments ordered by date |
| **TC-T1-F6-04** | F6 Comments | Get replies count | GET `/api/posts/[id]/comments` for parent comments | Returns 200; includes correct count of replies |
| **TC-T1-F7-01** | F7 Privacy | Create post with comment allowed | POST `/api/posts` with `allowComments: true` | Returns 201; post saved with comments enabled |
| **TC-T1-F7-02** | F7 Privacy | Create post with comments disabled | POST `/api/posts` with `allowComments: false` | Returns 201; post saved with comments disabled |
| **TC-T1-F7-03** | F7 Privacy | Create post with guest comments disabled | POST `/api/posts` with `allowStrangerComments: false` | Returns 201; post saved |
| **TC-T1-F7-04** | F7 Privacy | Comment on guest-disabled post as user | POST `/api/posts/[id]/comments` on restricted post with user session | Returns 201; comment created successfully |
| **TC-T1-F8-01** | F8 Capsules | Create time capsule | POST `/api/capsules` with future publish date | Returns 201; capsule created |
| **TC-T1-F8-02** | F8 Capsules | Reserve time capsule | POST `/api/capsules/[id]/reserve` as a user | Returns 200; reservation record created |
| **TC-T1-F8-03** | F8 Capsules | Recall time capsule | POST `/api/capsules/[id]/route` (DELETE/PATCH) before publish | Returns 200; capsule marked as recalled |
| **TC-T1-F8-04** | F8 Capsules | Fetch time capsule feed | GET `/api/capsules/feed` as guest/user | Returns 200; returns published time capsules |
| **TC-T1-F9-01** | F9 Moderation | Report post | POST `/api/reports` with valid reason and postId | Returns 201; report created with pending status |
| **TC-T1-F9-02** | F9 Moderation | Content moderation pass | POST `/api/posts` with clean content | Returns 201; post approved and created |
| **TC-T1-F9-03** | F9 Moderation | Block user account | POST `/api/users/[id]/block` with admin user session | Returns 200; user marked as banned in DB |
| **TC-T1-F9-04** | F9 Moderation | Check IP ban status | GET `/api/posts` from banned IP | Returns 403; access forbidden |
| **TC-T1-F10-01** | F10 Appeals | Submit user appeal | POST `/api/appeals` with reason for ban appeal | Returns 201; appeal saved |
| **TC-T1-F10-02** | F10 Appeals | Submit website feedback | POST `/api/feedback` with rating and review | Returns 201; feedback saved |
| **TC-T1-F10-03** | F10 Appeals | Fetch feedback list | GET `/api/feedback` with admin session | Returns 200; list of user feedbacks |
| **TC-T1-F10-04** | F10 Appeals | Admin review of appeal | PATCH `/api/appeals/[id]` with status and notes | Returns 200; appeal status updated to reviewed |
| **TC-T1-F11-01** | F11 Social | Block another user | POST `/api/users/[id]/block` with user session | Returns 200; block relationship created |
| **TC-T1-F11-02** | F11 Social | Collect post to personal board | POST `/api/collections` with valid postId | Returns 200; collection added successfully |
| **TC-T1-F11-03** | F11 Social | Fetch notifications feed | GET `/api/notifications` with user session | Returns 200; returns notifications list |
| **TC-T1-F11-04** | F11 Social | Mark notification as read | POST `/api/notifications/[id]/read` | Returns 200; notification marked as read |

---

### Tier 2: Boundary & Edge Cases (44 Test Cases)

| Test ID | Feature | Description | Action | Expected Result |
|---|---|---|---|---|
| **TC-T2-F1-01** | F1 Auth | Register with duplicate email | POST `/api/auth/register` with already used email | Returns 400 or 422; duplicate error |
| **TC-T2-F1-02** | F1 Auth | Login with wrong password | POST `/api/auth/login` with incorrect password | Returns 401; authentication failed |
| **TC-T2-F1-03** | F1 Auth | Access profile without token | GET `/api/auth/me` with no cookies | Returns 401; unauthorized |
| **TC-T2-F1-04** | F1 Auth | Register with weak password | POST `/api/auth/register` with password of 3 chars | Returns 400; validation failed |
| **TC-T2-F2-01** | F2 Profile | Nickname too short | PATCH `/api/users/me` with 1 character nickname | Returns 400; length validation error |
| **TC-T2-F2-02** | F2 Profile | Nickname too long | PATCH `/api/users/me` with 25 characters nickname | Returns 400; length validation error |
| **TC-T2-F2-03** | F2 Profile | Bio exceeding characters limit | PATCH `/api/users/me` with bio of 250 characters | Returns 400; bio limit error |
| **TC-T2-F2-04** | F2 Profile | Invalid date of birth | PATCH `/api/users/me` with invalid date string "invalid-date" | Returns 400; parsing error |
| **TC-T2-F3-01** | F3 Posting | Create post with empty content | POST `/api/posts` with `content: ""` | Returns 400; content empty error |
| **TC-T2-F3-02** | F3 Posting | Create post exceeding length | POST `/api/posts` with content of 15,000 characters | Returns 400; content length error |
| **TC-T2-F3-03** | F3 Posting | Post rate limit trigger | Send 10 posts in 5 seconds from same user | Returns 429; rate limit exceeded |
| **TC-T2-F3-04** | F3 Posting | Post image with invalid format | POST `/api/posts` with `imageUrl: "not-an-image-url"` | Returns 400; invalid URL or type |
| **TC-T2-F4-01** | F4 Discovery | Fetch non-existent post | GET `/api/posts/999999` | Returns 404; post not found |
| **TC-T2-F4-02** | F4 Discovery | Pagination index out of range | GET `/api/posts?page=9999` | Returns 200 with empty posts array |
| **TC-T2-F4-03** | F4 Discovery | Search with special regex characters | GET `/api/posts?tag=.*` | Returns 200 with matching tag or empty array (no server crash) |
| **TC-T2-F4-04** | F4 Discovery | Fetch hidden post | GET `/api/posts/[hidden_id]` | Returns 404; access denied |
| **TC-T2-F5-01** | F5 Interaction | Double like from same IP | POST `/api/posts/[id]/like` twice from same client IP | Returns 200; second call removes like (toggles) |
| **TC-T2-F5-02** | F5 Interaction | Double Me-Too from same user | POST `/api/posts/[id]/metoo` twice by same user | Returns 200; second call removes Me-Too (toggles) |
| **TC-T2-F5-03** | F5 Interaction | Me-Too on non-existent post | POST `/api/posts/999999/metoo` | Returns 404; post not found |
| **TC-T2-F5-04** | F5 Interaction | Like on hidden post | POST `/api/posts/[hidden_id]/like` | Returns 404; post not found |
| **TC-T2-F6-01** | F6 Comments | Reply to non-existent comment | POST `/api/posts/[id]/comments` with `parentId: 999999` | Returns 404; parent comment not found |
| **TC-T2-F6-02** | F6 Comments | Comment content empty | POST `/api/posts/[id]/comments` with `content: ""` | Returns 400; comment cannot be empty |
| **TC-T2-F6-03** | F6 Comments | Comment rate limit trigger | POST comments repeatedly within 1 second | Returns 429; too many requests |
| **TC-T2-F6-04** | F6 Comments | Reply to comment under different post | POST `/api/posts/[id_A]/comments` with `parentId` belonging to `id_B` | Returns 404 or 400; comment post mismatch |
| **TC-T2-F7-01** | F7 Privacy | Comment on allowComments=false post as registered user | POST `/api/posts/[id]/comments` on post with comments disabled | Returns 403; commenting disabled |
| **TC-T2-F7-02** | F7 Privacy | Comment on allowComments=false post as guest | POST `/api/posts/[id]/comments` on post with comments disabled | Returns 403; commenting disabled |
| **TC-T2-F7-03** | F7 Privacy | Comment on allowStrangerComments=false post as guest | POST `/api/posts/[id]/comments` on restricted post with no session | Returns 403; only registered users allowed |
| **TC-T2-F7-04** | F7 Privacy | Dynamic toggling of comment options | Change post options from allowed to disabled and attempt to reply | Returns 403; successfully blocked |
| **TC-T2-F8-01** | F8 Capsules | Schedule capsule in past | POST `/api/capsules` with `publishAt` in yesterday | Returns 400; publish date must be in future |
| **TC-T2-F8-02** | F8 Capsules | Create time capsule with empty text | POST `/api/capsules` with `content: ""` | Returns 400; content required |
| **TC-T2-F8-03** | F8 Capsules | Double reserve capsule | POST `/api/capsules/[id]/reserve` twice by same user | Returns 400 or 200 (idempotent, does not duplicate) |
| **TC-T2-F8-04** | F8 Capsules | Recall already published capsule | POST `/api/capsules/[id]/route` (DELETE) after publish time | Returns 400; cannot recall published capsule |
| **TC-T2-F9-01** | F9 Moderation | Double report same post | POST `/api/reports` twice for same post by same user | Returns 400 or 200 (prevents duplicate reports) |
| **TC-T2-F9-02** | F9 Moderation | Report with empty reason | POST `/api/reports` with `reason: ""` | Returns 400; reason cannot be empty |
| **TC-T2-F9-03** | F9 Moderation | Moderation bypass attempt | POST `/api/posts` with bad words separated by special characters | Returns 422; content moderation block |
| **TC-T2-F9-04** | F9 Moderation | Guest posting 6th post | POST `/api/posts` as guest after having posted 5 posts | Returns 403; limit reached |
| **TC-T2-F10-01** | F10 Appeals | Appeal by non-banned user | POST `/api/appeals` from an active, clean user | Returns 400; only banned users can appeal |
| **TC-T2-F10-02** | F10 Appeals | Feedback rating out of bounds | POST `/api/feedback` with `rating: "10"` (bounds: 1-5) | Returns 400; invalid rating range |
| **TC-T2-F10-03** | F10 Appeals | Empty appeal reason | POST `/api/appeals` with `reason: ""` | Returns 400; reason is required |
| **TC-T2-F10-04** | F10 Appeals | Double appeal submission | POST `/api/appeals` twice while first is still pending | Returns 400; appeal already in progress |
| **TC-T2-F11-01** | F11 Social | Block already blocked user | POST `/api/users/[id]/block` twice | Returns 200 or 400 (idempotent block) |
| **TC-T2-F11-02** | F11 Social | Block self | POST `/api/users/[self_id]/block` | Returns 400; cannot block yourself |
| **TC-T2-F11-03** | F11 Social | Collect already collected post | POST `/api/collections` twice for same postId | Returns 200 or 400 (avoids duplicate records) |
| **TC-T2-F11-04** | F11 Social | Mark non-existent notification as read | POST `/api/notifications/999999/read` | Returns 404; notification not found |

---

### Tier 3: Cross-Feature Combinations (31 Test Cases)

| Test ID | Primary Feature | Secondary Feature | Scenario Description | Action | Expected Result |
|---|---|---|---|---|---|
| **TC-T3-01** | F9 Moderation | F1 Auth | Banned user login blocked | Admin bans User A. User A attempts to login. | Login fails with 403 Forbidden. |
| **TC-T3-02** | F11 Social | F4 Discovery | Blocked user's posts excluded | User A blocks User B. User B posts Tree Hole C. User A fetches feed. | Tree Hole C is omitted from User A's feed. |
| **TC-T3-03** | F11 Social | F4 Discovery | Post author blocked view | User B blocks User A. User B fetches feed. | User B does not see posts made by User A. |
| **TC-T3-04** | F7 Privacy | F11 Social | Disabling comments triggers no notifications | Post has `allowComments: false`. User B attempts to comment (blocked). Check User A notifications. | No comment notification is generated for User A. |
| **TC-T3-05** | F8 Capsules | F4 Discovery | Future capsule hidden in feed | Create capsule scheduled for next week. Fetch posts feed. | Capsule content is not returned in the standard post list. |
| **TC-T3-06** | F8 Capsules | F4 Discovery | Published capsule visible in feed | Create capsule scheduled for +5s. Wait 5s and run cron. Fetch feed. | Capsule is published and appears in the feed. |
| **TC-T3-07** | F11 Social | F6 Comments | Reply to comment sends notification | User B replies to User A's comment. Fetch notifications for User A. | User A receives a notification about the reply. |
| **TC-T3-08** | F2 Profile | F3 Posting | Nickname change does not alter past posts | User A updates nickname. Fetch posts created by User A prior to update. | Old posts maintain the original nickname at post creation. |
| **TC-T3-09** | F10 Appeals | F9 Moderation | Approved appeal restores user state | Admin bans User A. User A appeals, Admin approves. User A posts. | User A is unbanned; post creation succeeds. |
| **TC-T3-10** | F5 Interaction | F11 Social | Me-Too sends notification | User B Me-Toos User A's post. Fetch notifications for User A. | User A receives a notification of the Me-Too action. |
| **TC-T3-11** | F11 Social | F5 Interaction | Blocked user cannot Me-Too | User A blocks User B. User B tries to Me-Too User A's post. | Me-Too fails with 403 or 404. |
| **TC-T3-12** | F8 Capsules | F11 Social | Time capsule release notifies subscribers | User B reserves User A's capsule. Capsule publishes. | User B receives a notification that the capsule is open. |
| **TC-T3-13** | F7 Privacy | F6 Comments | Comments toggle blocks replies dynamically | User B comments. User A toggles `allowComments` to false. User C replies to User B's comment. | Reply is blocked with 403. |
| **TC-T3-14** | F11 Social | F4 Discovery | Deleting post removes collection | User B collects User A's post. User A deletes the post. User B fetches collections. | The deleted post is removed or marked as unavailable. |
| **TC-T3-15** | F9 Moderation | F3 Posting | Guest post limit resets after registration | Guest posts 5 times. Guest registers account. User posts 6th post. | Post succeeds; guest limit does not block authenticated user. |
| **TC-T3-16** | F3 Posting | F6 Comments | Post author can comment even if stranger comments disabled | Post has `allowStrangerComments: false`. User A logs out, logs in as author. Comments. | Comment succeeds; author is not a "stranger". |
| **TC-T3-17** | F11 Social | F9 Moderation | Banned post hides collection | User B collects User A's post. Post gets reported and banned. User B fetches collections. | Banned post is omitted from collections. |
| **TC-T3-18** | F9 Moderation | F6 Comments | Banned comment replies hidden | User B comments. User C replies. User B's comment is reported/banned. Fetch comment list. | Parent comment and its replies are omitted or marked as deleted. |
| **TC-T3-19** | F8 Capsules | F10 Appeals | Scheduled time capsule of banned user suspended | User A schedules capsule. User A gets banned. Cron runs at publish time. | Capsule is not published (remains locked/hidden). |
| **TC-T3-20** | F9 Moderation | F5 Interaction | Banned user cannot Like posts | User A gets banned. User A sends POST `/api/posts/[id]/like`. | Request rejected with 403. |
| **TC-T3-21** | F11 Social | F11 Social | Blocking is mutual | User A blocks User B. User B fetches User A's profile or posts. | User B receives 404/403 (mutual block enforcement). |
| **TC-T3-22** | F6 Comments | F9 Moderation | Comment reported and auto-moderated | Comment containing toxic words is posted. | Comment is rejected during content moderation. |
| **TC-T3-23** | F8 Capsules | F11 Social | Cancel reservation removes notification | User B cancels reservation of User A's capsule. Capsule publishes. | User B does not receive a notification. |
| **TC-T3-24** | F3 Posting | F4 Discovery | Decryption key rotation check | Rotate global encryption key. Fetch old posts. | Old posts fail to decrypt, showing fallback notice. |
| **TC-T3-25** | F11 Social | F11 Social | Unread notifications count badge | User B likes User A's post. Check User A unread count. | Unread count increases by 1. |
| **TC-T3-26** | F11 Social | F11 Social | Read notification decreases badge | User A reads a notification. Check unread count. | Unread count decreases by 1. |
| **TC-T3-27** | F7 Privacy | F6 Comments | Comment on stranger-disabled post after session logout | User A registers, logs out, and attempts to comment. | Comment rejected with 403 (treated as guest/stranger). |
| **TC-T3-28** | F3 Posting | F9 Moderation | Auto-categorized post containing violations | Post contains violation and category keyword. | Post is blocked by moderation before categorization. |
| **TC-T3-29** | F6 Comments | F4 Discovery | Deleted post comments deleted | Delete post A. Fetch comments with postId A. | Returns empty list or 404 (cascade delete). |
| **TC-T3-30** | F8 Capsules | F9 Moderation | Device ban blocks capsule reservation | Banned guest IP attempts to reserve a capsule. | Reservation rejected with 403. |
| **TC-T3-31** | F11 Social | F6 Comments | Self-reply does not send notification | User A replies to their own comment. Check User A notifications. | No new notification is created. |

---

### Tier 4: Real-World Scenarios & Workloads (8 Test Cases)

#### TC-T4-01: Full User Onboarding & Interactive Posting Workflow
* **Description**: Simulates a new student registering, editing their profile, browsing existing tree holes, making their first post, and interacting with others.
* **Steps**:
  1. Register user `student@university.edu` -> Returns `201`.
  2. Log in with password -> Returns `200`, Cookie saved.
  3. Edit profile: Nickname = "StarryNight", Bio = "Coding under the stars" -> Returns `200`.
  4. Fetch post feed -> Returns `200`, verifies at least 1 default post exists.
  5. Publish a post: "Loving the new ambient music on this site! #Aesthetics" -> Returns `201`.
  6. Like an existing post with ID `1` -> Returns `200`, like count increases.
  7. Add a comment to post ID `1`: "Agreed, the campfire sound is so relaxing!" -> Returns `201`.

#### TC-T4-02: Guest-to-User Conversion under Posting Gating
* **Description**: Simulates a guest user sharing posts anonymously, hitting the guest post limit of 5, registering to remove the restriction, and continuing to share.
* **Steps**:
  1. Make 5 posts anonymously from IP `192.168.1.100` -> All return `201`.
  2. Attempt a 6th anonymous post -> Returns `403` ("游客模式仅限发布 5 条树洞，请注册账号继续分享").
  3. Register a new account `guest_converted@test.com` -> Returns `201`.
  4. Log in and acquire session cookie -> Returns `200`.
  5. Attempt to publish the 6th post with active session -> Returns `201` (successful bypass of guest limit).
  6. Verify post feed shows the new post linked to the registered user.

#### TC-T4-03: Privacy Advocate Moderation Workflow
* **Description**: A user publishes a sensitive confession and wants to strictly control who replies to prevent harassment.
* **Steps**:
  1. Logged-in User A publishes a post: "Feeling overwhelmed with exams... please only registered students reply." with `allowComments: true` and `allowStrangerComments: false` -> Returns `201`.
  2. Anonymous guest (no cookies) reads post A -> Returns `200` (can see post and toggles).
  3. Guest attempts to comment -> Returns `403` ("该帖子仅允许注册用户评论").
  4. Logged-in User B reads post A and posts a comment -> Returns `201` (succeeds).
  5. User A decides to close comments entirely: updates post A with `allowComments: false` -> Returns `200`.
  6. User B attempts to post another comment -> Returns `403` ("该帖子已关闭评论功能").

#### TC-T4-04: Malicious Posting and Moderation Appeal Loop
* **Description**: A user attempts to post offensive content, gets reported by the community, gets banned by an admin, and goes through the appeal process.
* **Steps**:
  1. User A posts content containing flagged words -> Returns `422` (blocked by auto-moderation).
  2. User A bypasses auto-moderation with lookalike characters: "V10LATION content" -> Returns `201`.
  3. User B reads the post, finds it offensive, and reports it: `reason: "Harassment"` -> Returns `201`.
  4. Admin reviews report list, finds the violation, and blocks User A -> DB updated.
  5. User A tries to log in -> Returns `403` ("您的账号已被封禁").
  6. User A submits an appeal: `reason: "I apologize, it was a misunderstand."` -> Returns `201`.
  7. Admin reviews the appeal, adds admin note, and approves it -> Returns `200`, user is unbanned.
  8. User A logs in successfully -> Returns `200`.

#### TC-T4-05: Time Capsule Reservation and Cron Release
* **Description**: A student schedules a message to be released to their friends in the future, friends subscribe, and the system publishes it automatically.
* **Steps**:
  1. User A creates a time capsule: "Good luck on the finals tomorrow!" scheduled for `current_time + 10 seconds` -> Returns `201`.
  2. User B fetches the time capsule feed and reserves User A's capsule -> Returns `200`.
  3. User B checks their notifications -> Verifies no notification yet.
  4. Time passes (+10 seconds); the background cron job `/api/internal/cron` is triggered -> Returns `200` (capsule published).
  5. User B fetches the posts feed -> Verifies the time capsule post is now visible.
  6. User B checks their notifications -> Verifies receipt of a "Time capsule published" notification.

#### TC-T4-06: Interactive Theme Switch and Custom Palette Persistence
* **Description**: A user switches between themes to check sound changes, and saves their favorite custom primary color.
* **Steps**:
  1. Mount home page; default theme is 0 (Starry) -> Mock audio plays drone sound.
  2. Toggle theme to 1 (Water) -> DOM gains `.light-theme`, mock audio plays low resonant sweep, water wave noise node starts.
  3. Toggle theme to 2 (Campfire) -> DOM gains `.campfire-theme`, mock audio plays pop/crackle and wood pink noise.
  4. Open custom color picker; select color `#AB82FF` -> CSS custom property `--primary-color` updated to `#AB82FF`, value saved to `localStorage` as `theme-custom-primary`.
  5. Reload page -> Page reads `localStorage`, verifies CSS variable `--primary-color` is set to `#AB82FF` on mount.

#### TC-T4-07: Social Distancing and Anti-Harassment Circle
* **Description**: User A is being harassed by User B, blocks User B, and verifies that they no longer see each other's posts, comments, or receive notifications.
* **Steps**:
  1. User B posts: "Hey check this out." -> Returns `201`.
  2. User A blocks User B -> Returns `200`.
  3. User A fetches the post feed -> Verifies User B's post is invisible.
  4. User A posts: "Having a peaceful day." -> Returns `201`.
  5. User B fetches feed -> Verifies User A's post is invisible.
  6. User B attempts to direct-fetch User A's post using ID -> Returns `404`.
  7. User B attempts to comment on User A's post using comment API -> Returns `404` or `403`.

#### TC-T4-08: Peak Traffic Simulation (Concurrency & Rate Limits)
* **Description**: Simulates 10 concurrent requests from guests and users to check server resilience, database locks, and rate limiters.
* **Steps**:
  1. Send 10 concurrent requests to `POST /api/posts` as Guest A from IP `192.168.2.1`.
  2. Verify that first 2 requests succeed (`201`), and subsequent 8 requests are rejected with `429` (Rate limit) or `403` (Post limit).
  3. Send 5 concurrent comments to post ID `1` from User B.
  4. Verify that rate limiter blocks 4 comments with `429`, and only 1 comment is written to the database.
  5. Check database integrity to ensure no duplicate rows or locks crashed the SQLite engine.
