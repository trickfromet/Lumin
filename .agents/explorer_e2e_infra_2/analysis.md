# E2E Testing Infrastructure & Test Case Analysis

## 1. Analysis of Features R1, R2, and R3 Implementation Status

Based on an investigation of the Lumin codebase (specifically `src/app/page.tsx`, `src/lib/audio.ts`, `prisma/schema.prisma`, and the API routes under `src/app/api`), the status of requirements R1, R2, and R3 is as follows:

### R1. Core Social Features & Settings
*   **Emoji Picker/Quick-Entry Entrance** (Post/Comment creation): 
    *   *Status*: **Not Implemented (Planned)**. There are no occurrences of "emoji" or emoji-picking components in the codebase.
    *   *Implementation detail*: Need to integrate a lightweight emoji picker or quick-entry buttons in the UI for writing posts and comments.
*   **Message Box UI / Notifications Panel**:
    *   *Status*: **Not Implemented (Planned)**. Although the backend has `/api/notifications` APIs and notification models, `src/app/page.tsx` does not consume notifications or render a Message Box UI.
    *   *Implementation detail*: Need to build a Message Box UI component that calls the notification APIs to list comments/replies and mark them as read.
*   **"My Posts" View/Page**:
    *   *Status*: **Fully Implemented**. The "Me" screen fetches and displays posts matching the current logged-in user.
    *   *Location*: `src/app/page.tsx:1515-1531` (fetches using `postsApi.list({ userId: currentUser.id, page: 1 })`) and `src/app/page.tsx:2969-3040` (renders moments under the "My Moments" tab).

### R2. Privacy Controls & Account Customization
*   **Database Schema for Comment Status**:
    *   *Status*: **Fully Implemented**. Columns exist in the database.
    *   *Location*: `prisma/schema.prisma:69-70` in model `Post`:
        *   `allowComments Boolean @default(true)`
        *   `allowStrangerComments Boolean @default(true)`
*   **Post Creation Privacy Toggles in APIs**:
    *   *Status*: **Not Implemented (In Progress)**. The `/api/posts` POST route (`src/app/api/posts/route.ts`) does not extract `allowComments` or `allowStrangerComments` from the body, nor does it pass them to `prisma.post.create`.
    *   *Status (GET)*: **Not Implemented (In Progress)**. The GET routes `/api/posts` and `/api/posts/[id]` do not return these flags in their responses.
*   **Comment Restriction Gating in API**:
    *   *Status*: **Not Implemented (In Progress)**. The POST comments route `/api/posts/[id]/comments/route.ts` does not check `allowComments` or `allowStrangerComments` on the parent post.
*   **Post Creation Privacy Toggles UI**:
    *   *Status*: **Not Implemented (Planned)**. No toggles are currently available in the Write UI screen.
*   **Nickname Modification Feature**:
    *   *Status*: **Fully Implemented**. Registered users can update their profile nickname via the settings UI and the profile API, which persists it.
    *   *Location*: Backend in `/api/users/me` (`src/app/api/users/me/route.ts:42-115`), frontend save function `handleSaveNickname` (`src/app/page.tsx:1816-1835`).

### R3. Visual & Audio Aesthetics (Sensory Experience)
*   **Water Ripple Transition Effect**:
    *   *Status*: **Partially Implemented (Transition Triggered, Visuals Basic)**. Enters a tree hole via click, sets transition states, and renders an expanding glow, but does not render a true canvas-based water ripple transition animation.
    *   *Location*: `src/app/page.tsx:1325-1503` (handles clicking canvas coordinates, triggers transition, and appends `.expanding-glow` element).
*   **Web Audio Optimization (ambient sounds)**:
    *   *Status*: **Partially Implemented**. Standard white/pink noise is generated and filtered, but parameters need tuning.
    *   *Location*: `src/lib/audio.ts`. The water theme lowpass filter frequency is set to 400Hz (needs adjustment to ~100-300Hz), and campfire crackle/rumble gains/frequencies are defined but need enhancement.
*   **Distinct Musical Note Trigger on Theme Switch**:
    *   *Status*: **Not Implemented (Planned)**. The `playThemeToggle()` method in `src/lib/audio.ts` plays a single hardcoded chord sweep rather than a distinct musical note or chord based on the active theme index.
*   **Theme Center Element Color Customization**:
    *   *Status*: **Not Implemented (Planned)**. The boat, capsule, and campfire center SVGs use hardcoded colors and lack color customization/picker triggers.

---

## 2. E2E Testing Architecture Recommendation

### Context & Offline Constraints
The workspace runs strictly offline. We cannot download npm packages or browser binaries from the internet. 

### Feasibility Analysis: Playwright vs. Custom Node-based Runner
1.  **Playwright Feasibility**:
    *   **CLI Availability**: Running `npx playwright --version` succeeds, returning version `1.60.0`.
    *   **Browser Cache**: The Playwright browser cache directory `$env:LOCALAPPDATA\ms-playwright` already contains pre-installed browser binaries:
        *   `chromium-1223` (Chromium browser)
        *   `chromium_headless_shell-1223` (Headless shell)
        *   `ffmpeg-1011` (FFmpeg)
        *   `winldd-1007` (WinLDD)
    *   This means **Playwright can be executed completely offline** without downloading browsers or external npm packages.
2.  **Custom Node-based Runner**:
    *   Would rely on basic HTTP clients and mocked/simulated DOM in memory (like JSDOM, which isn't installed in the project). It cannot test canvas rendering, Web Audio graphs, or visual CSS transitions, nor can it test real-world browser execution behavior.

### Recommendation
**We recommend using Playwright** as the E2E testing framework. It is already supported by the local environment, avoids complex mock implementations for the DOM/browser API, and can execute real-browser E2E validations against the running Next.js application (`http://localhost:3000`).

---

## 3. Recommended Testing Strategy for R3 Sensory Features

### A. CSS/Canvas Water Ripple Transition
*   **Verification Method**:
    1.  **Transition DOM State**: During transition, check that the `.expanding-glow` element is injected into the DOM body and then removed.
    2.  **State Exposure**: Expose `stateRef.current.isTransitioning` to the global `window` object (e.g. `window.__E2E_STATE__`). Playwright can evaluate `window.__E2E_STATE__.isTransitioning` to ensure it becomes `true` on node click and returns to `false` after the transition completes.
    3.  **Canvas Rendering**: Inspect that the canvas `#mainCanvas` exists and holds active width/height. Use visual regression testing (`expect(page).toHaveScreenshot()`) during the transition frame.

### B. Web Audio Noise Reduction & Campfire Enhancement
*   **Verification Method**:
    1.  **AudioContext Spying**: Inject an initialization script via Playwright (`page.addInitScript`) before the page loads. This script intercepts `window.AudioContext` (or `window.webkitAudioContext`) and wraps it in a spy proxy.
    2.  **Filter Parameter Asserts**: Wrap `AudioContext.prototype.createBiquadFilter` to capture filter node creations. We can assert that:
        *   A `lowpass` filter is instantiated when the Water theme (themeIdx=1) is active.
        *   The filter's `frequency.value` matches the target frequency range (e.g. 100-300Hz) to confirm noise reduction.
        *   A `bandpass` filter with frequency around 5000Hz is created for the campfire theme (themeIdx=2) to verify crackle audio nodes.
    3.  **Mute/Gain Verifications**: Spy on `GainNode.prototype.gain.setTargetAtTime` to assert that clicking the sound button ramps the master gain to `1` (unmuted) and `0` (muted).

### C. Theme Musical Note Trigger
*   **Verification Method**:
    1.  **Oscillator Frequency Capturing**: Wrap `AudioContext.prototype.createOscillator` in our spy proxy.
    2.  When the theme toggle button is clicked, capture the frequency of the oscillator node created.
    3.  Assert that switching to different themes plays distinct frequencies (e.g. note/pitch coordinates corresponding to theme indexes).

### D. Theme Color Picker Customization
*   **Verification Method**:
    1.  **Color Picker Input**: Interact with the color picker input elements (or preselected color buttons) using `page.locator('input[type="color"]').fill('#ff5722')` or `page.click('.palette-btn-orange')`.
    2.  **Visual CSS/SVG Color Change**: Query the SVG elements for the theme center (e.g. `#boat-container svg`, `#fire-container svg`, or `.capsule svg`) and assert their `fill` or `stroke` attributes (or style custom variables like `--theme-color`) match the selected hex value.
    3.  **Persistence Verification**: Perform `page.reload()`, and verify that the customized color remains applied to the SVG center elements by retrieving the attribute again.

---

## 4. E2E Test Suite Specification (127 Test Cases)

The following is the catalog of 127 test cases distributed across Tiers 1-4 for features F1-F11.

### Feature Map
*   **F1**: User Authentication & Registration (Register, Login, Logout, Reset Password)
*   **F2**: Anonymous Post Creation & Client Encryption
*   **F3**: Post Feed & Category/Tag/Language Filtering
*   **F4**: Empathy ("Me Too") System & Tiers
*   **F5**: Comment & Nested Reply System
*   **F6**: Privacy Controls & Comment Gating
*   **F7**: Social Notifications & Message Box
*   **F8**: Nickname Customization & Zodiac Calculation
*   **F9**: User Blocking System
*   **F10**: Web Audio Ambient Sounds & Interactive Audio
*   **F11**: UI Themes, Color Customization & Transitions

---

### Tier 1: Feature Coverage (55 Tests)

| Test ID | Feature | Description | Inputs | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F1-T1-01** | F1 | User Registration | Valid email, password, invitation code. | Registration succeeds, session started. |
| **F1-T1-02** | F1 | User Login | Registered email and password. | Successful login, cookie token set. |
| **F1-T1-03** | F1 | User Logout | Click Logout button. | Token cookie cleared, session terminated. |
| **F1-T1-04** | F1 | Fetch Current User API | GET `/api/auth/me` with session. | Returns profile details without password hash. |
| **F1-T1-05** | F1 | Reset Password | Email, valid registration code, new password. | Password updated successfully. |
| **F2-T1-01** | F2 | Create Post with Tags | Logged-in user posts content with `#tags`. | Post saved, tags parsed in DB. |
| **F2-T1-02** | F2 | Guest Post Creation | Unauthenticated user posts content. | Post created with guest nickname. |
| **F2-T1-03** | F2 | Client-Side Encryption | Text content for post. | Content encrypted on client before API dispatch. |
| **F2-T1-04** | F2 | Auto-Classification | Content suggesting specific category. | Post assigned correct category automatically. |
| **F2-T1-05** | F2 | Post Language Detection | Content in English. | Language flag set to "en" in DB. |
| **F3-T1-01** | F3 | Retrieve Post Feed | GET `/api/posts?page=1`. | Returns latest posts list, decrypted. |
| **F3-T1-02** | F3 | Filter Feed by Category | GET `/api/posts?categoryId=2`. | Only posts in category 2 are returned. |
| **F3-T1-03** | F3 | Filter Feed by Tag | GET `/api/posts?tag=Daily`. | Only posts containing tag "Daily" returned. |
| **F3-T1-04** | F3 | Filter Feed by Language | GET `/api/posts?language=en`. | Only English posts are returned. |
| **F3-T1-05** | F3 | Recommendation Feed | GET `/api/posts/feed`. | Returns recommended post list based on interest. |
| **F4-T1-01** | F4 | Add Me Too Reaction | Click Me Too button on post. | Me Too count increments, active visual state. |
| **F4-T1-02** | F4 | Remove Me Too Reaction | Click active Me Too button on post. | Me Too count decrements, inactive visual state. |
| **F4-T1-03** | F4 | Guest Me Too Reaction | Guest user clicks Me Too. | Me Too recorded by IP, count increments. |
| **F4-T1-04** | F4 | Low Me Too Tier Glow | Post with 2 Me Too counts. | UI node renders with faint default glow. |
| **F4-T1-05** | F4 | High Me Too Tier Glow | Post with 60 Me Too counts. | UI node renders with intense pulsating glow. |
| **F5-T1-01** | F5 | Create Top-level Comment | Comment content on a post. | Comment saved, comment count increments. |
| **F5-T1-02** | F5 | Create Nested Reply | Reply content, parentCommentId. | Reply saved under parent comment. |
| **F5-T1-03** | F5 | List Comments | GET `/api/posts/[id]/comments`. | Returns comments sorted chronologically. |
| **F5-T1-04** | F5 | Guest Commenting | Unauthenticated user posts comment. | Comment allowed, shows guest nickname. |
| **F5-T1-05** | F5 | Comment Moderation Pass | Clean comment content. | Pass moderation, immediately saved. |
| **F6-T1-01** | F6 | Post with Comments Allowed | allowComments = true. | Users can successfully comment. |
| **F6-T1-02** | F6 | Post with Comments Disabled | allowComments = false. | Comment posts rejected with 403/422. |
| **F6-T1-03** | F6 | Post with Guest Comments | allowStrangerComments = true. | Guests can successfully comment. |
| **F6-T1-04** | F6 | Guest Gating Restricted | allowStrangerComments = false. | Guests rejected with 403; members allowed. |
| **F6-T1-05** | F6 | Privacy Toggle UI Changes | Toggle checkboxes in Create Post screen. | Changes reflected in POST body payload. |
| **F7-T1-01** | F7 | Comment Notification | User B comments on User A's post. | Notification is created for User A. |
| **F7-T1-02** | F7 | Unread Notifications Count | GET `/api/notifications/unread-count`. | Returns correct count of unread notifications. |
| **F7-T1-03** | F7 | Message Box UI Display | Click Notification icon. | Message box opens, displaying notifications list. |
| **F7-T1-04** | F7 | Mark Notification as Read | View notification in Message Box. | Notification isRead set to true, count decrements. |
| **F7-T1-05** | F7 | Mark All as Read | Click "Mark all as read" button. | All user notifications marked read in DB. |
| **F8-T1-01** | F8 | Modify Profile Nickname | Submit nickname modification request. | Profile nickname updated in database. |
| **F8-T1-02** | F8 | Nickname Sync on New Post | Modify nickname, then publish new post. | New post renders with updated nickname. |
| **F8-T1-03** | F8 | Update Profile Bio | Update bio in profile settings. | Profile bio saved and displayed. |
| **F8-T1-04** | F8 | Zodiac Cusp Calculation | Save birthday to "1998-05-21". | Calculates Taurus/Gemini cusp zodiac correctly. |
| **F8-T1-05** | F8 | Retrieve Profile | GET `/api/users/me`. | Returns nickname, bio, birthday, and zodiac. |
| **F9-T1-01** | F9 | Block User | Click Block on User B. | Block record created in DB. |
| **F9-T1-02** | F9 | Filter Blocked User Posts | User A retrieves post feed. | User B's posts are filtered out. |
| **F9-T1-03** | F9 | Filter Blocked User Comments | User A views comments thread. | User B's comments are filtered out. |
| **F9-T1-04** | F9 | Unblock User | Click Unblock User B. | Block removed, B's posts visible again. |
| **F9-T1-05** | F9 | Blocked Post Direct Get | User A GET `/api/posts/[B's post id]`.| Returns 404 (Post not found). |
| **F10-T1-01** | F10 | Audio Mute Toggle | Click Mute/Unmute button. | AudioManager mute state toggles, gain ramps. |
| **F10-T1-02** | F10 | Space theme soundscapes | Switch to Space theme. | Background drone oscillators play. |
| **F10-T1-03** | F10 | Water theme soundscapes | Switch to Water theme. | Wave noise buffer plays through lowpass filter. |
| **F10-T1-04** | F10 | Campfire theme soundscapes | Switch to Campfire theme. | Rumble and crackle noise buffers play. |
| **F10-T1-05** | F10 | UI Interactive sounds | Hover/click nodes on the page. | Plays short thematic audio feedback. |
| **F11-T1-01** | F11 | Theme UI toggle | Click Theme Switch in Top Bar. | Theme cycles 0 -> 1 -> 2, HTML classes update. |
| **F11-T1-02** | F11 | Theme Auto-Switching | Time Mocked to 18:00. | Campfire theme (themeIdx=2) auto-applies. |
| **F11-T1-03** | F11 | Canvas Presentation | Load home page. | Canvas is initialized with viewport dimensions. |
| **F11-T1-04** | F11 | Color Picker Rendering | Open theme settings. | Preselected colors and color input render. |
| **F11-T1-05** | F11 | Persist Theme State | Switch to Campfire theme, reload. | Campfire theme persists after page reload. |

---

### Tier 2: Boundary & Edge Cases (55 Tests)

| Test ID | Feature | Description | Inputs | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F1-T2-01** | F1 | Duplicate Email Register | Register with already registered email. | Fails with 400/409, shows email taken. |
| **F1-T2-02** | F1 | Invalid Email Format | Register with email `not-an-email`. | Fails validation, registration blocked. |
| **F1-T2-03** | F1 | Weak Password Register | Register with 3-character password. | Fails validation, password requirements warning. |
| **F1-T2-04** | F1 | Reset with Bad Code | Invalid/Expired invite code for reset. | Password reset rejected with 400/403. |
| **F1-T2-05** | F1 | Expired Cookie Token Access | GET `/api/users/me` with expired token.| Returns 401 Unauthorized. |
| **F2-T2-01** | F2 | Empty Post Content | Create post with empty content text. | Rejected with 400 Bad Request. |
| **F2-T2-02** | F2 | Ultra-long Post Content | Content with 10,000 characters. | Handled gracefully (truncated or 400 error). |
| **F2-T2-03** | F2 | Guest Post Limit | Guest IP submits 6th post. | Rejected with 403 Forbidden. |
| **F2-T2-04** | F2 | Post Content Moderation Block | Content with blacklisted words. | Rejected with 422 Unprocessable Content. |
| **F2-T2-05** | F2 | Invalid Category Id | Create post with categoryId = 9999. | Ignored or defaults to auto-classification. |
| **F3-T2-01** | F3 | Pagination Page Out-of-Bounds | GET `/api/posts?page=99999`. | Returns empty list, total count correct. |
| **F3-T2-02** | F3 | Non-existent Tag Filter | GET `/api/posts?tag=xyz123`. | Returns empty posts array. |
| **F3-T2-03** | F3 | Tag XSS Injection | GET `/api/posts?tag=<script>...`. | Sanitized safely, does not execute script. |
| **F3-T2-04** | F3 | Encryption Decrypt Fallback | Damaged encryption payload in DB. | Decrypt fails gracefully, shows fallback text. |
| **F3-T2-05** | F3 | Recommendations Empty DB | Recommendations with 0 posts in DB. | Returns empty list successfully, no crash. |
| **F4-T2-01** | F4 | Duplicate Me Too (Member) | Double click Me Too concurrently. | Handled cleanly, count increments only by 1. |
| **F4-T2-02** | F4 | Duplicate Me Too (Guest) | Guest IP clicks Me Too twice. | DB block prevents duplicates, count stays +1. |
| **F4-T2-03** | F4 | Concurrent Me Too Updates | Multiple users react concurrently. | DB locks prevent race conditions, count is exact. |
| **F4-T2-04** | F4 | Me Too on Invalid Post | POST `/api/posts/99999/metoo`. | Returns 404 Not Found. |
| **F4-T2-05** | F4 | Negative Me Too Count | Attempt to unmetoo an unreacted post. | Rejected or prevents decrement below 0. |
| **F5-T2-01** | F5 | Comment Content Too Long | Comment with 5000 characters. | Truncated or returns 400 Bad Request. |
| **F5-T2-02** | F5 | Nested Reply Invalid Parent | Comment with parentId = 999999. | Rejected with 404/400. |
| **F5-T2-03** | F5 | Commenting on Invalid Post | POST `/api/posts/999999/comments`. | Returns 404 Not Found. |
| **F5-T2-04** | F5 | Comment Moderation Block | Comment with profanity. | Rejected with 422 Unprocessable Content. |
| **F5-T2-05** | F5 | Delete Someone Else's Comment| User A attempts to delete B's comment. | Rejected with 403 Forbidden. |
| **F6-T2-01** | F6 | Guest Comments Gated | Guest comment on post with allowStrangerComments=false. | Rejected with 403 Forbidden. |
| **F6-T2-02** | F6 | Member Comments Gating | Member comment on post with allowComments=false. | Rejected with 403 Forbidden. |
| **F6-T2-03** | F6 | Nested Gated Comment | Reply to comment on comments-disabled post.| Rejected with 403. |
| **F6-T2-04** | F6 | Update Gating on Active Post | Change allowComments to false with comments already present. | Existing comments remain, new posts blocked. |
| **F6-T2-05** | F6 | API comments gating bypass | Direct REST call ignoring UI toggle block. | Rejected by backend API gating validation. |
| **F7-T2-01** | F7 | Notification on Self-Action | Author comments on their own post. | No notification is generated. |
| **F7-T2-02** | F7 | Blocked User Notification | Blocked user comments on post. | No notification generated. |
| **F7-T2-03** | F7 | Read Other's Notification | User B marks User A's notification read.| Rejected with 403/404. |
| **F7-T2-04** | F7 | Extreme Notifications Count | User with 5000 unread notifications. | Returns count rapidly without query timeout. |
| **F7-T2-05** | F7 | Post Delete Clean notifications| Delete post. | Cascade deletes related notifications in DB. |
| **F8-T2-01** | F8 | Nickname Too Short | Change nickname to "A". | Rejected with 400. |
| **F8-T2-02** | F8 | Nickname Too Long | Change nickname to 25 characters. | Rejected with 400. |
| **F8-T2-03** | F8 | Nickname Moderation Block | Change nickname to banned word. | Rejected with 422 Unprocessable Content. |
| **F8-T2-04** | F8 | Edge Date Zodiac | Birthdays on boundary dates (e.g. 12-22). | Returns correct boundary zodiac (Capricorn). |
| **F8-T2-05** | F8 | Invalid Birthday Date | Submit birthday string `not-a-date`. | Rejected with validation error. |
| **F9-T2-01** | F9 | Block Self | User A blocks User A. | Rejected with 400 Bad Request. |
| **F9-T2-02** | F9 | Duplicate Block Request | User A blocks User B twice. | DB constraint catches, returns 200/400. |
| **F9-T2-03** | F9 | Block Non-existent User | User A blocks user ID = 999999. | Rejected with 404 Not Found. |
| **F9-T2-04** | F9 | Block guest IP | Guest IP blocks. | Handled gracefully. |
| **F9-T2-05** | F9 | Cascade blocks on delete | Delete blocker user account. | Cascade deletes blocking records in DB. |
| **F10-T2-01** | F10 | Autoplay block recovery | Browser blocks web audio autoplay. | AudioManager suspends and resumes upon click. |
| **F10-T2-02** | F10 | Rapid Mute Toggle | Click sound indicator 10 times in 1s. | Volume ramps complete smoothly without pop. |
| **F10-T2-03** | F10 | Rapid Theme Switching Audio | Rapidly click theme switch. | Nodes stop/re-init cleanly, no memory leak. |
| **F10-T2-04** | F10 | Water Filter Frequency Casing | Extreme frequency inputs. | Lowpass values clamped to standard ranges. |
| **F10-T2-05** | F10 | Audio node leak test | Toggle themes 100 times. | Confirms no dangling oscillators active in graph. |
| **F11-T2-01** | F11 | Custom Color Invalid Hex | Set color value to `invalid-string`. | Rejected or falls back to theme default color. |
| **F11-T2-02** | F11 | Canvas click empty space | Click coordinates away from nodes. | No transition triggered. |
| **F11-T2-03** | F11 | Canvas Extreme Resize | Resize browser viewport to 8K. | Elements scale and reposition without crash. |
| **F11-T2-04** | F11 | Canvas Double click Node | Double click tree hole node. | Only one transition/glow triggers. |
| **F11-T2-05** | F11 | Cross-session Custom Color | Log in on new device. | Persisted customized element color is applied. |

---

### Tier 3: Cross-Feature Combinations (11 Tests)

| Test ID | Features | Description | Inputs / Scenario | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **F3-T3-01** | F1/F8/F2 | Nickname Sync on Auth Change | Register -> Post 1 -> Change Nickname -> Post 2 -> Logout -> Login. | Post 1 shows old nickname, Post 2 shows new nickname. Both decrypted. |
| **F3-T3-02** | F2/F6/F5 | Post Gating Update | User A posts gated comments -> User B comments (fails) -> User A toggles gating open -> User B comments. | Comments rejected initially (403), comments succeed after toggle update. |
| **F3-T3-03** | F2/F9/F3 | Block Action Feed Filter | User A blocks User B. User B posts. User A retrieves feed. | User B's new post does not appear in User A's feed. |
| **F3-T3-04** | F5/F7/F9 | Notifications Gating on Block | User B comments on A's post. A is notified. A blocks B. B deletes/comments. | A receives no further notifications from B, old notifications hidden. |
| **F3-T3-05** | F6/F1/F5 | Stranger Gating Registration | Post allowStrangerComments=false. Guest comments (fails) -> Guest registers -> comments. | Comment fails as guest (403), comment succeeds after login. |
| **F3-T3-06** | F10/F11 | Audio-Visual Theme Sync | Toggle Space theme -> visual stars render -> drone sound plays. Toggle Campfire -> campfire renders -> rumble sound plays. | Visual layout and active audio nodes align perfectly on theme change. |
| **F3-T3-07** | F2/F4/F10 | Empathy Visual-Audio Feedback | Click Me Too on active theme. | Plays synthesized theme sound and expands node size concurrently. |
| **F3-T3-08** | F1/F2/F9 | Guest Post Ban & IP Block | Guest post flags moderation warning -> Guest gets banned -> Guest registers on same IP. | Banned IP blocked from posting even after registering. |
| **F3-T3-09** | F3/F8/F1 | User Deletion Cleanup | User A deletes account. | All posts, comments, blocks, and notifications cascade deleted. |
| **F3-T3-10** | F11/F8/F10| Custom Color & Theme Notes | Modify center color -> color persists -> toggle theme -> plays note. | Custom colors do not interfere with synthesized theme note pitches. |
| **F3-T3-11** | F2/F7/F5 | Nested Comment Notification Loop| User A posts -> User B comments -> User A replies -> User B replies. | Both A and B receive correct notifications for replies. |

---

### Tier 4: Real-World Application Scenarios (6 Tests)

*   **F122: Complete User Journey (Onboarding to Empathy)**
    *   *Scenario*: User registers with a valid email and invite code -> modifies profile settings (nickname, birthday) -> clicks a Space constellation -> writes an encrypted post with tags `#feelings` -> views "My Posts" to verify the post is present -> switches theme to Campfire -> clicks Me Too on another post -> logs out.
    *   *Expected*: The entire flow executes cleanly; DB reflects all actions; UI transitions run smoothly.
*   **F123: Anonymous Guest-to-Registered User Experience**
    *   *Scenario*: An unregistered guest visits the site -> clicks a water node -> reads posts -> tries to write a 6th post (blocked by guest limits) -> registers a new account -> successfully publishes the 6th post -> updates nickname -> comments on a peer's post.
    *   *Expected*: Rate limit restriction functions correctly for the guest, and data integrity is maintained as the user transitions from guest to authenticated.
*   **F124: Multi-User Collaborative Discussion with Gating**
    *   *Scenario*: User A creates a post with `allowStrangerComments=false`. User B (registered) and Guest C view the feed. User B posts a comment (succeeds). Guest C tries to post a comment (fails with 403). User A receives a notification for User B's comment, opens the Message Box, views the notification (marking it read), and replies to User B's comment.
    *   *Expected*: Correct gating validation on the API/UI; notifications are dispatched and marked read correctly; nested comment threads render.
*   **F125: Moderation, Warning, and Ban Enforcement Flow**
    *   *Scenario*: Registered User A posts spam -> moderation flags it -> warning notification is sent to User A -> User A posts spam again -> User A is banned -> User A attempts to login (fails with ban message) -> User A submits an appeal -> admin reviews and approves the appeal -> User A is unbanned and logs in.
    *   *Expected*: Moderation rules, ban flags, block policies, and appeal tracking operate seamlessly.
*   **F126: Theme Center Elements and Visual-Audio Aesthetic Customization**
    *   *Scenario*: User visits platform at 18:00 (auto-switches to Campfire theme) -> unmutes audio -> adjusts campfire rumble volume -> opens color customization -> selects custom hex `#ff5722` -> switches theme to Space -> switches back to Campfire.
    *   *Expected*: Custom color `#ff5722` remains applied, audio volume settings are preserved, and theme switching sounds trigger correctly.
*   **F127: High-Load Concurrent Posting and Empathy Simulation**
    *   *Scenario*: 20 concurrent users (mix of guests and registered users) publish posts, add comments, and click Me Too on a single trending post concurrently.
    *   *Expected*: The database resolves concurrent writes under SQLite transactional locking without deadlock; count aggregates match the total actions.
