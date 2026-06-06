# E2E Testing Infrastructure Analysis and Master Plan

## Executive Summary
This report analyzes the codebase of Lumin (Student Anonymous Tree Hole Platform) and proposes a comprehensive E2E testing architecture designed to function in an offline environment where external package downloads and browser binary installations are unavailable. Playwright is found to be unfeasible in this restricted environment due to these network blocks. We propose a robust Node-based HTTP API integration and DOM/client simulator test runner using custom mocks. We also detail concrete strategies for testing the R3 sensory aesthetics features (water ripple canvas transition, Web Audio ambient synthesis, musical note triggers, and theme color customizers) using mock node graphs and virtual DOM element assertions. Finally, we provide a complete list of exactly 127 test cases distributed across Tiers 1–4 covering Features F1–F11.

---

## 1. Codebase Analysis (R1, R2, R3 Features)

Based on an analysis of the repository's files and database models, here is the current implementation and planning state of features R1, R2, and R3:

### R1: Core Social Features & Settings
*   **Emoji picker/quick-entry entrance**: *Not Implemented / Planned (Milestone 3)*. There is currently no code relating to "emoji" inside the frontend page (`src/app/page.tsx`).
*   **Message Box UI/panel**: *Not Implemented / Planned (Milestone 3)*. The backend notifications API endpoints (`/api/notifications/*`) are in place, but the frontend lacks a panel to fetch, display, and mark notifications as read.
*   **"My Posts" view/page**: *Partially Implemented (Milestone 3)*. The frontend has a profile screen (`profileVisible`) which queries `postsApi.list({ userId: currentUser.id })` to fetch posts created by the current user, but a dedicated navigation entry and unified view need styling/routing integration.

### R2: Privacy Controls & Account Customization
*   **Modify DB schema and APIs for comments toggling**: *Database Implemented, API Pending Integration (Milestone 2)*. The `Post` model in `prisma/schema.prisma` already includes `allowComments` and `allowStrangerComments` fields defaulting to `true`. However:
    *   `POST /api/posts` does not destructure or store these fields from the request body.
    *   `GET /api/posts` and `GET /api/posts/[id]` do not map these fields in the returned post object.
    *   `POST /api/posts/[id]/comments/route.ts` does not check these toggles against the post before saving comments.
*   **Toggles during post creation**: *Not Implemented / Planned (Milestone 3)*. The frontend create-post form lacks the UI switches for these fields.
*   **Nickname modification**: *Implemented (Milestone 3)*. The profile screen lets registered users edit their nickname and triggers `users.updateMe({ nickname })` which hits `PATCH /api/users/me`.

### R3: Visual & Audio Aesthetics (Sensory Experience)
*   **Water ripple transition**: *Partially Implemented (Milestone 4)*. Clicking a star cluster node on the canvas triggers `stateRef.current.isTransitioning = true`, appends a CSS-based `.expanding-glow` element to the DOM body, and applies an `.active` class to trigger an expansion transition, before opening the reading screen.
*   **Web Audio optimization (Water & Campfire)**: *Implemented (Milestone 4)*. `src/lib/audio.ts` contains a client-side `AudioManager` class that uses Web Audio API nodes (`OscillatorNode`, `GainNode`, `BiquadFilterNode`, `ConvolverNode`) to synthesize ambient sounds. Water sound is lowpass-filtered white noise (peak ~400Hz) modulated by a low-frequency oscillator (LFO) to simulate ripples. Campfire sound combines low-pass filtered pink noise (rumble, ~600Hz) and band-pass filtered white noise (crackle, ~5000Hz).
*   **Musical theme notes**: *Partially Implemented (Milestone 4)*. Theme switching triggers `playThemeToggle()` which plays a rising and falling triangle oscillator wave (150Hz -> 250Hz -> 150Hz), but it plays the same sound regardless of the theme. Distinct notes corresponding to each specific theme are not yet mapped.
*   **Theme center element color customization**: *Not Implemented / Planned (Milestone 4)*. The constellation nodes render colors from `BRAND_PALETTE` in order of cluster index, but there is no custom color picker UI or persistence mechanism for the user to customize them.

---

## 2. E2E Testing Architecture Recommendation (Offline Environment)

### Playwright Feasibility Analysis
*   **Feasibility: UNFEASIBLE**. 
*   **Reasons**:
    1.  **Dependency block**: Playwright packages (`@playwright/test`) are not in `package.json` / `package-lock.json`. In an offline environment, we cannot download these packages from the npm registry.
    2.  **Browser binary block**: Playwright relies on specific, sandboxed browser binaries (Chromium, Firefox, WebKit) downloaded to local cache directories (e.g. `AppData/Local/ms-playwright`). Offline execution of `npx playwright install` fails immediately.
    3.  **Path differences**: Running E2E tests against headless browsers in restricted Windows shells often hits execution policy and permission blocks.

### Recommended Custom Architecture
We recommend implementing a custom **Node-based HTTP API integration and DOM/client simulator test runner** (`npm run test:e2e`).

*   **API Layer Testing**: Use Node's built-in `fetch` client to hit the local Next.js dev server. We can manage sessions by extracting the `th_token` cookie from register/login responses and passing it in subsequent request headers.
*   **Client Simulator Layer**: Use `jsdom` (if available in global caches) or write a custom virtual client script in Node that parses responses and simulates user interactions.
*   **Mocking Browser APIs**: Since Node lacks browser APIs like `window.AudioContext`, `HTMLCanvasElement`, and `localStorage`, the runner will inject standard mocks into the global scope:
    ```typescript
    global.window = {};
    global.localStorage = {
      store: {},
      getItem(key) { return this.store[key] || null; },
      setItem(key, val) { this.store[key] = String(val); }
    };
    ```

---

## 3. R3 Sensory Experience Testing Guide

### A. Testing CSS/Canvas Water Ripple Transitions
*   **Approach**: Validate DOM element lifecycle in the client simulator.
*   **Mocks**: Inject `document` and mock canvas clicks in the test environment.
*   **Verification Steps**:
    1.  Call the click handler of a cluster node.
    2.  Assert that a `div` element with the class `expanding-glow` is appended to `document.body`.
    3.  Verify that `glow.classList.contains('active')` is `true`.
    4.  Simulate a timer of 1200ms and check that `readingVisible` state changes to `true`.
    5.  Assert that after the animation completes (e.g. 1700ms), the glow element is removed from the DOM.

### B. Testing Web Audio Ambient Parameters (Noise & Crackle)
*   **Approach**: Mock the Web Audio graph and inspect the node parameters.
*   **Mocks**: Create a mock class for `AudioContext` and its node generators:
    ```typescript
    class MockAudioContext {
      createOscillator() { return { frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, setTargetAtTime() {} }, connect() {} }; }
      createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
      createConvolver() { return { buffer: null, connect() {} }; }
    }
    ```
*   **Verification Steps**:
    1.  Instantiate `AudioManager` under mock environment.
    2.  Set theme to Water (`themeIdx = 1`). Assert that the created `BiquadFilterNode` has `type = 'lowpass'` and `frequency = 400` Hz (minimizing white noise hiss).
    3.  Set theme to Campfire (`themeIdx = 2`). Verify that two noise chains are created: a lowpass filter at `600` Hz (representing low campfire rumble) and a bandpass filter at `5000` Hz (representing campfire crackle).
    4.  Assert that the gain values for lowpass and bandpass filters map correctly to `0.07` and `0.025` respectively.

### C. Testing Musical Note Triggers
*   **Approach**: Trace oscillator frequency outputs during theme switches.
*   **Verification Steps**:
    1.  Spy on `AudioContext.createOscillator`.
    2.  Trigger theme switch (e.g., call `audio.playThemeToggle()` or `audio.setTheme(idx)`).
    3.  Assert that the generated oscillator node plays a distinct starting frequency or chord sequence assigned to that theme:
        *   Theme 0 (Space): Pitch/notes corresponding to Space scales.
        *   Theme 1 (Water): Ripple pitch sweeps.
        *   Theme 2 (Campfire): Crackle sweep tones.

### D. Testing Theme Color Picker
*   **Approach**: Test state persistence and visual styling update hooks.
*   **Verification Steps**:
    1.  Simulate user selecting a color in the picker (e.g. changing input value).
    2.  Assert that the selected RGB values are written to `localStorage`.
    3.  Assert that the updated color values are applied to the inline styles of the tree hole nodes or used inside the canvas redraw loops (which can be monitored by checking context fillStyle parameters).

---

## 4. Master Test Cases List (127 Cases)

Below is the list of exactly 127 test cases distributed across Tiers 1-4 for features F1-F11.

### Features Index (F1–F11)
*   **F1**: User Authentication & Account Management
*   **F2**: Tree Holes & Star Clusters
*   **F3**: Post Creation & Sharing
*   **F4**: Post Feed & Recommendations
*   **F5**: Post Interaction (MeToo & Likes)
*   **F6**: Comments & Replies (including Comment Privacy Controls)
*   **F7**: Message Box & Notifications
*   **F8**: Time Capsules & Reservations
*   **F9**: Content Moderation & Appeals
*   **F10**: User Relations (Blocks & Safety)
*   **F11**: Sensory Experience & Customization

---

### Tier 1: Core Feature Happy Paths (44 Cases)

#### F1: User Authentication & Account Management
1.  **`TC-T1-F1-1`**: **User Registration Happy Path**
    *   *Description*: Verify a new user can register with valid credentials.
    *   *Steps*: Post credentials to `/api/auth/register`.
    *   *Expected*: Returns HTTP `200` with user details.
2.  **`TC-T1-F1-2`**: **User Login Happy Path**
    *   *Description*: Verify registered user can log in.
    *   *Steps*: Post correct email and password to `/api/auth/login`.
    *   *Expected*: Returns HTTP `200` and sets `th_token` session cookie.
3.  **`TC-T1-F1-3`**: **Profile Retrieval**
    *   *Description*: Retrieve profile details for the logged-in user.
    *   *Steps*: Send `GET` to `/api/auth/me` with session cookie.
    *   *Expected*: Returns HTTP `200` containing the email, role, and nickname.
4.  **`TC-T1-F1-4`**: **User Logout**
    *   *Description*: Verify logout clears user credentials.
    *   *Steps*: Send `POST` to `/api/auth/logout`.
    *   *Expected*: Returns HTTP `200` and clears session cookie.

#### F2: Tree Holes & Star Clusters
5.  **`TC-T1-F2-1`**: **Fetch Categories List**
    *   *Description*: Verify active category groups can be fetched.
    *   *Steps*: Send `GET` to `/api/categories`.
    *   *Expected*: Returns list of categories (Emotional, Daily, Mood, etc.) sorted by `sortOrder`.
6.  **`TC-T1-F2-2`**: **Fetch Tree Holes Constellation Data**
    *   *Description*: Verify tree holes constellation mapping is returned.
    *   *Steps*: Send `GET` to `/api/treeholes`.
    *   *Expected*: Returns active tree holes with post counts.
7.  **`TC-T1-F2-3`**: **Render Star Cluster Labels**
    *   *Description*: Verify labels are created on canvas load.
    *   *Steps*: Load home page and mock tree hole data.
    *   *Expected*: DOM elements with class `.constellation-label` are rendered in correct layout positions.
8.  **`TC-T1-F2-4`**: **Mobile Scaling Check**
    *   *Description*: Verify UI layout scales down on small screens.
    *   *Steps*: Mock `window.innerWidth = 375` (mobile width).
    *   *Expected*: Star cluster coordinates and radii are scaled down by mobile factor (`0.4`).

#### F3: Post Creation & Sharing
9.  **`TC-T1-F3-1`**: **Publish New Post (User)**
    *   *Description*: Verify logged-in user can share a new story.
    *   *Steps*: Send `POST` to `/api/posts` with valid text and category ID.
    *   *Expected*: Returns HTTP `201` with created post structure.
10. **`TC-T1-F3-2`**: **Automatic Category Classification**
    *   *Description*: Verify posts are classified auto-categorized if category ID is omitted.
    *   *Steps*: Post a story with high emotional valence and no category ID.
    *   *Expected*: Moderation/Classification module auto-assigns "Emotional" category.
11. **`TC-T1-F3-3`**: **Post Encryption**
    *   *Description*: Verify post text content is encrypted.
    *   *Steps*: Create post and inspect SQLite database record.
    *   *Expected*: Content is encrypted using AES-GCM; database fields `encryptedContent`, `iv`, and `authTag` are populated.
12. **`TC-T1-F3-4`**: **Post Image Upload**
    *   *Description*: Verify attaching an image to a post.
    *   *Steps*: Post image file data to `/api/upload/image`.
    *   *Expected*: Returns HTTP `200` with the public image CDN/upload URL.

#### F4: Post Feed & Recommendations
13. **`TC-T1-F4-1`**: **Fetch Post Feed by Tag**
    *   *Description*: Retrieve posts under a specific tag tree hole.
    *   *Steps*: Send `GET` to `/api/posts?tag=Daily`.
    *   *Expected*: Returns posts matching "Daily" tag only.
14. **`TC-T1-F4-2`**: **Retrieve "My Posts" Feed**
    *   *Description*: Retrieve posts created by the current user.
    *   *Steps*: Send `GET` to `/api/posts?userId=<current_user_id>`.
    *   *Expected*: Returns posts associated with the user's ID.
15. **`TC-T1-F4-3`**: **Recommendations Feed**
    *   *Description*: Retrieve user recommendations.
    *   *Steps*: Send `GET` to `/api/recommendations`.
    *   *Expected*: Returns recommended posts.
16. **`TC-T1-F4-4`**: **Feed Pagination**
    *   *Description*: Verify pagination payload.
    *   *Steps*: Send `GET` to `/api/posts?page=1&pageSize=10`.
    *   *Expected*: Returns first 10 posts with `page` and `totalPages` variables in response.

#### F5: Post Interaction (MeToo & Likes)
17. **`TC-T1-F5-1`**: **Click MeToo (User)**
    *   *Description*: Verify registered user can MeToo a post.
    *   *Steps*: Send `POST` to `/api/posts/[id]/metoo` (authenticated).
    *   *Expected*: Returns HTTP `200`, increments MeToo count.
18. **`TC-T1-F5-2`**: **MeToo Tier Update**
    *   *Description*: Verify post metooTier updates.
    *   *Steps*: Trigger MeToo clicks on a post until count matches next tier limit.
    *   *Expected*: Retrieve post and verify `metooTier` updates (e.g. from cold to warm).
19. **`TC-T1-F5-3`**: **Click Like**
    *   *Description*: Verify user can like a post.
    *   *Steps*: Send `POST` to `/api/posts/[id]/like`.
    *   *Expected*: Returns HTTP `200`, increments likes count.
20. **`TC-T1-F5-4`**: **Retrieve Interaction Flags**
    *   *Description*: Verify client receives interaction state flags.
    *   *Steps*: Get posts feed after liking/metooing.
    *   *Expected*: returned post items have `userHasMetoed: true` or equivalent flags.

#### F6: Comments & Replies
21. **`TC-T1-F6-1`**: **Post Comment**
    *   *Description*: Verify posting comment on post with comments enabled.
    *   *Steps*: Post a comment to `/api/posts/[id]/comments` (comments allowed).
    *   *Expected*: Returns HTTP `201` with comment details.
22. **`TC-T1-F6-2`**: **Post Reply to Comment**
    *   *Description*: Verify replying to an existing comment.
    *   *Steps*: Post comment body with `parentId` targeting a comment.
    *   *Expected*: Returns HTTP `201` successfully linking parent ID.
23. **`TC-T1-F6-3`**: **Fetch Post Comments List**
    *   *Description*: Verify retrieval of hierarchical comments.
    *   *Steps*: Send `GET` to `/api/posts/[id]/comments`.
    *   *Expected*: Returns list of top-level comments and replies counts.
24. **`TC-T1-F6-4`**: **Guest Comments Allowance**
    *   *Description*: Verify guests can comment if allowed.
    *   *Steps*: Post comment anonymously to post with `allowStrangerComments: true`.
    *   *Expected*: Returns HTTP `201` with generated guest nickname.

#### F7: Message Box & Notifications
25. **`TC-T1-F7-1`**: **Fetch Notifications**
    *   *Description*: Verify retrieval of received notifications.
    *   *Steps*: Send `GET` to `/api/notifications` (authenticated).
    *   *Expected*: Returns list of comments/replies notifications.
26. **`TC-T1-F7-2`**: **Unread Badge Count**
    *   *Description*: Verify retrieving unread count.
    *   *Steps*: Send `GET` to `/api/notifications/unread-count`.
    *   *Expected*: Returns correct unread integer.
27. **`TC-T1-F7-3`**: **Mark Single Read**
    *   *Description*: Verify marking notification as read.
    *   *Steps*: Send `POST` to `/api/notifications/[id]/read`.
    *   *Expected*: Returns HTTP `200` updating `isRead` to `true`.
28. **`TC-T1-F7-4`**: **Mark All Read**
    *   *Description*: Verify batch read action.
    *   *Steps*: Send `POST` to `/api/notifications/read-all`.
    *   *Expected*: Returns HTTP `200`, setting all unread notifications to read.

#### F8: Time Capsules & Reservations
29. **`TC-T1-F8-1`**: **Create Time Capsule**
    *   *Description*: Verify creating a future-dated capsule.
    *   *Steps*: Post capsule content with future `publishAt` date to `/api/capsules`.
    *   *Expected*: Returns HTTP `201` with capsule marked unpublished.
30. **`TC-T1-F8-2`**: **Reserve Time Capsule**
    *   *Description*: Verify user can register interest.
    *   *Steps*: Send `POST` to `/api/capsules/[id]/reserve`.
    *   *Expected*: Returns HTTP `200` reservation details.
31. **`TC-T1-F8-3`**: **Cron Release Action**
    *   *Description*: Verify cron job publishes expired capsules.
    *   *Steps*: Trigger scheduled time release via `/api/internal/cron`.
    *   *Expected*: Database update: expired capsules are set to `isPublished: true`.
32. **`TC-T1-F8-4`**: **Fetch Capsule Feed**
    *   *Description*: Verify retrieval of public capsules.
    *   *Steps*: Send `GET` to `/api/capsules/feed`.
    *   *Expected*: Returns list of published time capsules.

#### F9: Content Moderation & Appeals
33. **`TC-T1-F9-1`**: **Moderation Clean Content**
    *   *Description*: Verify clean content passes moderation.
    *   *Steps*: Post clean text (e.g. "Have a nice day").
    *   *Expected*: Post is successfully created.
34. **`TC-T1-F9-2`**: **Report Banned Post**
    *   *Description*: Verify reporting a post.
    *   *Steps*: Send `POST` to `/api/reports` with reason and target post ID.
    *   *Expected*: Returns HTTP `201` setting status to `pending`.
35. **`TC-T1-F9-3`**: **Submit Appeal**
    *   *Description*: Verify appeal submission for a ban.
    *   *Steps*: Send `POST` to `/api/appeals` with reason text.
    *   *Expected*: Returns HTTP `201` appeal record.
36. **`TC-T1-F9-4`**: **Verify Content Classification**
    *   *Description*: Verify classifier accuracy.
    *   *Steps*: Send content matching standard emotional theme to classifier helper.
    *   *Expected*: Classifier returns category "情感" (Emotional).

#### F10: User Relations (Blocks & Safety)
37. **`TC-T1-F10-1`**: **Block User**
    *   *Description*: Verify blocking another user.
    *   *Steps*: Send `POST` to `/api/users/[id]/block`.
    *   *Expected*: Returns HTTP `201` creating blocker/blocked relationship.
38. **`TC-T1-F10-2`**: **Unblock User**
    *   *Description*: Verify unblocking.
    *   *Steps*: Send `DELETE` or equivalent unblock call to `/api/users/[id]/block`.
    *   *Expected*: Returns HTTP `200` deleting block relationship.
39. **`TC-T1-F10-3`**: **Query Block List**
    *   *Description*: Verify fetching block list.
    *   *Steps*: Fetch blockers/blocks index.
    *   *Expected*: Returns list of blocked user profiles.
40. **`TC-T1-F10-4`**: **Check Block Relationship**
    *   *Description*: Verify block checker helper.
    *   *Steps*: Call `checkBlockStatus(userA, userB)` in code.
    *   *Expected*: Returns `true` if relation exists.

#### F11: Sensory Experience & Customization
41. **`TC-T1-F11-1`**: **Water Ripple Transition Render**
    *   *Description*: Verify ripple DOM element creation.
    *   *Steps*: Click constellation node in client simulator.
    *   *Expected*: Glow element appended with class `.expanding-glow.active`.
42. **`TC-T1-F11-2`**: **Web Audio AudioContext State**
    *   *Description*: Verify Web Audio initialization.
    *   *Steps*: Click unmute button on page.
    *   *Expected*: `audio.isMuted` becomes `false`, AudioContext changes state to `running`.
43. **`TC-T1-F11-3`**: **Visual Theme Switch**
    *   *Description*: Verify switching active theme index.
    *   *Steps*: Click theme switch toggle button.
    *   *Expected*: State updates and canvas redraw loop triggers with target parameters (e.g. `waterT` or `fireT` transitions).
44. **`TC-T1-F11-4`**: **Nickname Modification**
    *   *Description*: Verify profile nickname updates.
    *   *Steps*: Save new nickname via profile field.
    *   *Expected*: Profile nickname updates in UI; API PATCH returns success.

---

### Tier 2: Boundary & Edge Cases (44 Cases)

#### F1: User Authentication & Account Management
45. **`TC-T2-F1-1`**: **Register Duplicate Email**
    *   *Description*: Attempt registering with an already used email.
    *   *Expected*: Returns HTTP `400` or `422` with "Email already exists" message.
46. **`TC-T2-F1-2`**: **Login Wrong Password**
    *   *Description*: Attempt login with incorrect password.
    *   *Expected*: Returns HTTP `401` or `400` with authentication error.
47. **`TC-T2-F1-3`**: **Reset Password Invalid Code**
    *   *Description*: Try resetting password with non-existent or expired code.
    *   *Expected*: Returns HTTP `400` or `404` validation error.
48. **`TC-T2-F1-4`**: **Register Bad Email Format**
    *   *Description*: Attempt registration with invalid email formats.
    *   *Expected*: Returns HTTP `400` validation error.

#### F2: Tree Holes & Star Clusters
49. **`TC-T2-F2-1`**: **Fetch Non-existent Category**
    *   *Description*: Query database for category ID that does not exist.
    *   *Expected*: Returns empty list or 404.
50. **`TC-T2-F2-2`**: **Handle Empty Tree Holes List**
    *   *Description*: Load constellation map with no tree hole records in database.
    *   *Expected*: UI renders empty background cleanly without JavaScript exceptions.
51. **`TC-T2-F2-3`**: **Star Cluster Label Overflow**
    *   *Description*: Render constellation label with excessively long name.
    *   *Expected*: Label element handles text overflow (wrapping or ellipsis) without breaking layout coordinates.
52. **`TC-T2-F2-4`**: **Empty Star Cluster Coordinate Generation**
    *   *Description*: Coordinate builder handles clusters with 0 posts.
    *   *Expected*: Generates minimum constellation node count (5 nodes) safely without division-by-zero errors.

#### F3: Post Creation & Sharing
53. **`TC-T2-F3-1`**: **Post Excessively Long Content**
    *   *Description*: Try posting text exceeding maximum limit (e.g. 5000 characters).
    *   *Expected*: Returns HTTP `400` validation error.
54. **`TC-T2-F3-2`**: **Post Empty Content**
    *   *Description*: Try posting empty or whitespace-only content.
    *   *Expected*: Returns HTTP `400` "Content cannot be empty".
55. **`TC-T2-F3-3`**: **Post Image Upload Bad File Type**
    *   *Description*: Upload non-image file type (e.g. plain text, executable).
    *   *Expected*: Returns HTTP `400` or `415` invalid file type error.
56. **`TC-T2-F3-4`**: **Post Image Size Limit**
    *   *Description*: Upload image file exceeding maximum size (e.g. 10MB).
    *   *Expected*: Returns HTTP `413` Payload Too Large or `400` validation error.

#### F4: Post Feed & Recommendations
57. **`TC-T2-F4-1`**: **Feed Pagination Negative Page**
    *   *Description*: Retrieve posts feed with `page = -1`.
    *   *Expected*: Returns page 1 (paginator clamps index to positive integers).
58. **`TC-T2-F4-2`**: **Feed Pagination Large PageSize**
    *   *Description*: Retrieve posts with `pageSize = 1000`.
    *   *Expected*: Returns first page clamped to a maximum size of 50.
59. **`TC-T2-F4-3`**: **Fetch Feed Empty Tag**
    *   *Description*: Query post list for tag that has no stories.
    *   *Expected*: Returns empty posts list payload with total page count set to 0.
60. **`TC-T2-F4-4`**: **Retrieve Non-existent Post by ID**
    *   *Description*: Send `GET` to `/api/posts/999999`.
    *   *Expected*: Returns HTTP `404` post not found error.

#### F5: Post Interaction (MeToo & Likes)
61. **`TC-T2-F5-1`**: **Duplicate MeToo Prevention**
    *   *Description*: Send secondary MeToo click on the same post by the same user.
    *   *Expected*: Returns HTTP `400` or `409` conflict error (user already MeToo'd post).
62. **`TC-T2-F5-2`**: **Duplicate Likes Prevention**
    *   *Description*: Send secondary post Like click from the same IP address.
    *   *Expected*: Returns HTTP `400` or `409` conflict error.
63. **`TC-T2-F5-3`**: **MeToo Non-existent Post**
    *   *Description*: Attempt MeToo click on invalid post ID.
    *   *Expected*: Returns HTTP `404` post not found.
64. **`TC-T2-F5-4`**: **Like Non-existent Post**
    *   *Description*: Attempt Like click on invalid post ID.
    *   *Expected*: Returns HTTP `404` post not found.

#### F6: Comments & Replies
65. **`TC-T2-F6-1`**: **Comment on Closed Post**
    *   *Description*: Attempt posting comment when post settings have `allowComments: false`.
    *   *Expected*: Returns HTTP `403` Forbidden with comments closed message.
66. **`TC-T2-F6-2`**: **Stranger Comment on Gated Post**
    *   *Description*: Guest tries posting comment when post settings have `allowStrangerComments: false`.
    *   *Expected*: Returns HTTP `403` Forbidden with registration required message.
67. **`TC-T2-F6-3`**: **Reply to Non-existent Comment**
    *   *Description*: Reply to a parent comment ID that does not exist in database.
    *   *Expected*: Returns HTTP `404` parent comment not found.
68. **`TC-T2-F6-4`**: **Comment Content Size Boundary**
    *   *Description*: Post comment exceeding character limit (e.g. 2000 characters).
    *   *Expected*: Returns HTTP `400` validation error.

#### F7: Message Box & Notifications
69. **`TC-T2-F7-1`**: **Mark Non-existent Notification Read**
    *   *Description*: Send read request for invalid notification ID.
    *   *Expected*: Returns HTTP `404` notification not found.
70. **`TC-T2-F7-2`**: **Guest Notifications Read Attempt**
    *   *Description*: Fetch notification counts anonymously.
    *   *Expected*: Returns HTTP `401` Unauthorized or fails gracefully.
71. **`TC-T2-F7-3`**: **Mark All Read on Empty Notifications**
    *   *Description*: Send `read-all` when user has zero notifications.
    *   *Expected*: Returns HTTP `200` with zero updates.
72. **`TC-T2-F7-4`**: **Fetch Notifications with Bad Token**
    *   *Description*: Query list using forged authorization header.
    *   *Expected*: Returns HTTP `401` Unauthorized.

#### F8: Time Capsules & Reservations
73. **`TC-T2-F8-1`**: **Create Capsule in the Past**
    *   *Description*: Attempt creating capsule with past `publishAt` date.
    *   *Expected*: Returns HTTP `400` validation error.
74. **`TC-T2-F8-2`**: **Reserve Published Capsule**
    *   *Description*: Reserve a time capsule that has already opened.
    *   *Expected*: Returns HTTP `400` bad request.
75. **`TC-T2-F8-3`**: **Duplicate Reservation**
    *   *Description*: Send secondary reservation on same capsule by same user.
    *   *Expected*: Returns HTTP `400` conflict.
76. **`TC-T2-F8-4`**: **Reserve Non-existent Capsule**
    *   *Description*: Reserve capsule ID that does not exist.
    *   *Expected*: Returns HTTP `404` capsule not found.

#### F9: Content Moderation & Appeals
77. **`TC-T2-F9-1`**: **Post Sensitive Words**
    *   *Description*: Post content containing blacklisted words.
    *   *Expected*: Returns HTTP `422` Unprocessable Content with moderation block details.
78. **`TC-T2-F9-2`**: **Comment Sensitive Words**
    *   *Description*: Post comment containing sensitive words.
    *   *Expected*: Returns HTTP `422` Unprocessable Content.
79. **`TC-T2-F9-3`**: **Appeal with Empty Reason**
    *   *Description*: Submit ban appeal with empty reasoning text.
    *   *Expected*: Returns HTTP `400` validation error.
80. **`TC-T2-F9-4`**: **Report Non-existent Post**
    *   *Description*: Submit report for invalid post ID.
    *   *Expected*: Returns HTTP `404` post not found.

#### F10: User Relations (Blocks & Safety)
81. **`TC-T2-F10-1`**: **Duplicate Block**
    *   *Description*: Attempt blocking the same user twice.
    *   *Expected*: Returns HTTP `400` or `409` conflict.
82. **`TC-T2-F10-2`**: **Self-Block Prevention**
    *   *Description*: Attempt to block own user ID.
    *   *Expected*: Returns HTTP `400` invalid request.
83. **`TC-T2-F10-3`**: **Unblock Non-existent Block**
    *   *Description*: Attempt unblocking a user who is not currently blocked.
    *   *Expected*: Returns HTTP `400` or `404` not found.
84. **`TC-T2-F10-4`**: **Block Non-existent User**
    *   *Description*: Block user ID that does not exist in SQLite.
    *   *Expected*: Returns HTTP `404` user not found.

#### F11: Sensory Experience & Customization
85. **`TC-T2-F11-1`**: **Click Empty Canvas Coordinates**
    *   *Description*: Click coordinate on constellation canvas where no nodes reside.
    *   *Expected*: UI state remains idle, no transition animations play.
86. **`TC-T2-F11-2`**: **Web Audio Volume Clamp**
    *   *Description*: Set volume variables to negative numbers.
    *   *Expected*: MasterGain clamps values to `0.0` safely.
87. **`TC-T2-F11-3`**: **Background Cover Size Limit**
    *   *Description*: Upload profile cover image exceeding file size limit (e.g. 5MB).
    *   *Expected*: Returns HTTP `400` size error.
88. **`TC-T2-F11-4`**: **Theme Center Invalid Color Selection**
    *   *Description*: Send invalid hex/RGB string to color customizer.
    *   *Expected*: Falls back to the default theme palette color.

---

### Tier 3: Cross-Feature Combinations (24 Cases)

89. **`TC-T3-FC-1`**: **Block/Post Feed Integration**
    *   *Description*: Verify blocked user's posts disappear from blocker's feed.
    *   *Steps*: User A blocks User B. Query User A's feed.
    *   *Expected*: User B's posts are absent from the list.
90. **`TC-T3-FC-2`**: **Block/Comments Integration**
    *   *Description*: Verify blocked user's comments disappear from blocker's posts.
    *   *Steps*: User A blocks User B. Fetch comments on User A's posts.
    *   *Expected*: Comments authored by User B are filtered out.
91. **`TC-T3-FC-3`**: **Guest to Registered Conversions Rate limits**
    *   *Description*: Verify guest posting conversions reset rate limits.
    *   *Steps*: Guest posts 5 posts (guest limit hit). Guest registers account and logs in.
    *   *Expected*: Rate limit counter resets; registered user is allowed to publish new posts.
92. **`TC-T3-FC-4`**: **Retroactive Commenting Shutdown**
    *   *Description*: Verify shutting down comments disables comments creation but displays existing comments.
    *   *Steps*: Post has 3 comments. Owner sets `allowComments: false`. Query comments list, then attempt comment.
    *   *Expected*: Old comments load successfully; comment attempt returns HTTP `403`.
93. **`TC-T3-FC-5`**: **Stranger Comment Gate Change**
    *   *Description*: Verify comments gating restriction checks work under active toggle updates.
    *   *Steps*: Owner changes `allowStrangerComments` to `false`. Guest tries commenting (blocked); User logs in and comments (passed).
    *   *Expected*: Guest gets HTTP `403` error; registered user gets HTTP `201` success.
94. **`TC-T3-FC-6`**: **Nickname Change History**
    *   *Description*: Verify nickname changes do not corrupt author fields on historical posts.
    *   *Steps*: User A registers, publishes Post 1. User A updates nickname to "NewA". User A publishes Post 2.
    *   *Expected*: Post 1 retains User A's old nickname (or matches spec on snapshot); Post 2 displays "NewA".
95. **`TC-T3-FC-7`**: **Post Deletion Cleanup**
    *   *Description*: Verify cascade deletes on post deletion.
    *   *Steps*: Delete post ID. Inspect comments, likes, and tags databases.
    *   *Expected*: Comments, likes, and tags referencing the deleted post ID are removed.
96. **`TC-T3-FC-8`**: **Banned User Login block**
    *   *Description*: Verify banned users can login but not post or interact.
    *   *Steps*: Ban User A. User A logs in successfully. User A attempts to publish post.
    *   *Expected*: Login returns HTTP `200`; post creation returns HTTP `403` containing ban expiry reason.
97. **`TC-T3-FC-9`**: **Time Capsule Notification Trigger**
    *   *Description*: Verify time capsule release generates notifications.
    *   *Steps*: Capsule is marked published via cron.
    *   *Expected*: Notification entry is inserted for the capsule owner.
98. **`TC-T3-FC-10`**: **Auto-Hide on Spam Reports**
    *   *Description*: Verify posts are auto-hidden after exceeding report thresholds.
    *   *Steps*: Submit 5 reports on a single post ID.
    *   *Expected*: Post is marked `isHidden: true` in SQLite.
99. **`TC-T3-FC-11`**: **Constellation Updates on Auto-Hide**
    *   *Description*: Verify hidden posts disappear from constellation counts.
    *   *Steps*: Post is auto-hidden. Fetch `/api/treeholes`.
    *   *Expected*: Constellation tag counts decrement; hidden post is not retrievable in category feeds.
100. **`TC-T3-FC-12`**: **Banned User Restoration Appeal**
     *   *Description*: Verify approving appeal restores user permissions.
     *   *Steps*: Admin approves User A's ban appeal. User A tries to publish post.
     *   *Expected*: Post is successfully created.
101. **`TC-T3-FC-13`**: **User Deletion Cleanup**
     *   *Description*: Verify complete profile deletion cleans up personal records.
     *   *Steps*: Delete User account record.
     *   *Expected*: All blocks, reservations, and posts associated with User ID are deleted.
102. **`TC-T3-FC-14`**: **Deactivated Category Constellation Removal**
     *   *Description*: Verify deactivated categories hide their clusters.
     *   *Steps*: Admin sets category `isActive = false`. Load home page constellation map.
     *   *Expected*: Category is omitted from constellation listings; posts remain accessible via specific URL only.
103. **`TC-T3-FC-15`**: **Post Interaction Recommendations Shift**
     *   *Description*: Verify liking a post shifts recommendations algorithms.
     *   *Steps*: User likes posts tagged "Family". Fetch recommended feed.
     *   *Expected*: Recommendations API scores posts tagged "Family" higher.
104. **`TC-T3-FC-16`**: **Comment Notification Lifecycle**
     *   *Description*: Verify comment posting triggers owner notification.
     *   *Steps*: User B comments on User A's post.
     *   *Expected*: Notification entry created for User A; unread count increments.
105. **`TC-T3-FC-17`**: **Nested Comment Reply Notification Routing**
     *   *Description*: Verify reply notifications route to parent commenter only.
     *   *Steps*: User C replies to User B's comment on User A's post.
     *   *Expected*: Notification created for User B; User A receives no new notification unless User A is User B.
106. **`TC-T3-FC-18`**: **Notification Count Badge Sync**
     *   *Description*: Verify badge count decrements on read.
     *   *Steps*: Mark one notification read. Get unread count.
     *   *Expected*: Returned unread count is decremented by 1.
107. **`TC-T3-FC-19`**: **Guest to User Like Conflict Prevention**
     *   *Description*: Verify likes do not conflict when guest registers.
     *   *Steps*: Guest likes post (IP-based). Guest registers. Registered user likes same post.
     *   *Expected*: Likes count does not double increment; duplicate checked correctly.
108. **`TC-T3-FC-20`**: **Asymmetric Blocks**
     *   *Description*: Verify blocking is asymmetric.
     *   *Steps*: User A blocks User B.
     *   *Expected*: User A can still see User B's comments, but User B cannot view User A's posts.
109. **`TC-T3-FC-21`**: **Post Tag Classification and Constellation Link**
     *   *Description*: Verify post auto-tagging affects constellation map immediately.
     *   *Steps*: Post content containing "工作" keywords. Fetch `/api/treeholes`.
     *   *Expected*: Constellation node for "工作" tag updates node count.
110. **`TC-T3-FC-22`**: **Visual theme customization persistence**
     *   *Description*: Verify custom center elements persist colors across themes.
     *   *Steps*: Update theme center elements colors. Toggle theme index.
     *   *Expected*: Redrawn canvas clusters continue using the custom color values.
111. **`TC-T3-FC-23`**: **Logout Notification Polling Kill**
     *   *Description*: Verify logout halts background traffic.
     *   *Steps*: Log out user.
     *   *Expected*: Background requests for notification updates halt; message indicators reset.
112. **`TC-T3-FC-24`**: **Avatar Update Sync**
     *   *Description*: Verify avatar updates propagate to historical comments.
     *   *Steps*: User A uploads new avatar. Fetch comments on posts.
     *   *Expected*: Comments by User A display the new avatar URL.

---

### Tier 4: Real-World Application Workloads (15 Cases)

113. **`TC-T4-WS-1`**: **New User Onboarding Workflow**
     *   *Description*: Verify complete onboarding flow.
     *   *Steps*: Register new account -> login -> land on constellation map -> select Night theme -> toggle audio to unmute -> click Emotional cluster -> verify ripple transition -> load post detail -> read post.
     *   *Expected*: Happy path workflow completes with correct styling and audio activations.
114. **`TC-T4-WS-2`**: **Content Sharing & Feedback Cycle**
     *   *Description*: Verify standard posting-commenting cycle.
     *   *Steps*: Log in -> write post -> upload image -> set comments enabled -> publish -> verify post appears in "My Posts" -> receive comment from another user -> check notifications badge -> open message box -> read comment -> reply.
     *   *Expected*: Interpersonal loop completes; notifications correctly mark as read upon viewing.
115. **`TC-T4-WS-3`**: **Guest Limits and Account Registration Conversion**
     *   *Description*: Simulate a guest hitting sharing limits, registering, and converting.
     *   *Steps*: Visit as guest -> like posts -> write 5 posts (success) -> attempt 6th post (returns 403 limit warning) -> click registration -> register email -> log in -> post 6th post successfully.
     *   *Expected*: System restricts guest activity but unlocks all boundaries after registration.
116. **`TC-T4-WS-4`**: **Post Comments Privacy Hardening Flow**
     *   *Description*: Verify comments privacy controls gating.
     *   *Steps*: User A logs in -> creates post with `allowStrangerComments: false` -> logs out -> attempts comment anonymously (returns 403) -> User B logs in -> comments on post (returns 201).
     *   *Expected*: Comments are successfully restricted based on user authentication status.
117. **`TC-T4-WS-5`**: **Safety & Moderation Lifecycle**
     *   *Description*: Verify user reporting and admin appeal actions.
     *   *Steps*: User A writes post containing sensitive phrases -> system blocks with 422 -> User A writes clean post -> User B reports post -> admin sets post hidden -> User A appeals -> admin restores post.
     *   *Expected*: Moderation cycles behave correctly; database flags align at each step.
118. **`TC-T4-WS-6`**: **Social Gating Interpersonal Flow**
     *   *Description*: Verify user blocks restrict interaction.
     *   *Steps*: User A creates post -> User B logs in and posts offensive comment -> User A blocks User B -> User B's comment disappears from User A's view -> User B tries to view User A's post list (returns empty/block message).
     *   *Expected*: Core blockers successfully shield user feeds.
119. **`TC-T4-WS-7`**: **Sensory Theme Journey**
     *   *Description*: Verify visual/audio theme shifts.
     *   *Steps*: Land on homepage -> daytime theme applies -> click Starry Night theme -> low drone audio starts -> select custom color from picker -> canvas updates elements to green -> refresh page -> verify green constellation color persists.
     *   *Expected*: User styling selections are persisted and re-rendered successfully.
120. **`TC-T4-WS-8`**: **Time Capsule Journey**
     *   *Description*: Verify scheduled time capsule release.
     *   *Steps*: User A creates capsule with `publishAt = tomorrow` -> User B reserves capsule -> advance database clock -> trigger cron handler -> capsule is published -> check User B's notifications feed -> view capsule.
     *   *Expected*: Chronological release works; reservation triggers correct message routing.
121. **`TC-T4-WS-9`**: **Idle Empathy Transition Flow**
     *   *Description*: Verify automatic idle triggers.
     *   *Steps*: Land on homepage -> remain idle for 10 seconds without clicks.
     *   *Expected*: Empathy modal fades in; clicking empathy prompt triggers water ripple glow and transitions to random post.
122. **`TC-T4-WS-10`**: **Long Stay Ambient Event Flow**
     *   *Description*: Verify extended reading audio triggers.
     *   *Steps*: Open reading pane -> remain on page for 3 minutes.
     *   *Expected*: Background drone sweeps to cello note event; toggling mute variable safely cancels node execution.
123. **`TC-T4-WS-11`**: **Password Recovery Workload**
     *   *Description*: Verify password reset flow.
     *   *Steps*: Click forgot password -> enter email -> receive invite code -> input code and new password -> verify update -> log in using new credentials.
     *   *Expected*: System registers credentials updates and permits session startup.
124. **`TC-T4-WS-12`**: **Emoji-Driven Social Flow**
     *   *Description*: Verify emojis entry in publish and comments.
     *   *Steps*: Open create-post pane -> click emoji picker -> click heart emoji -> publish -> open comment pane on post -> click comment emoji picker -> add smile emoji -> post comment.
     *   *Expected*: Content contains raw unicode characters; database stores and retrieves strings successfully.
125. **`TC-T4-WS-13`**: **Multi-Device Profile Sync**
     *   *Description*: Verify profile uploads sync across devices.
     *   *Steps*: Log in on Desktop -> upload background cover -> login on Mobile simulator.
     *   *Expected*: Mobile profile screen background-image style attribute contains the correct desktop uploaded file path.
126. **`TC-T4-WS-14`**: **Guest Rate-Limit Heavy Load Performance**
     *   *Description*: Simulate load triggers on guest API endpoints.
     *   *Steps*: Send 50 concurrent guest requests to `/api/posts`.
     *   *Expected*: Rate limiting triggers HTTP `429` for subsequent guest requests while authenticated users continue querying successfully.
127. **`TC-T4-WS-15`**: **Account Deletion & Personal Data Cleanup**
     *   *Description*: Verify complete account erasure.
     *   *Steps*: Register -> post stories and comments -> delete account -> search database tables for user details.
     *   *Expected*: Personal records are deleted or set null; post elements maintain clean guest fallback states where appropriate.
