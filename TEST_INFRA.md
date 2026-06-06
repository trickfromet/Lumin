# Lumin E2E Testing Infrastructure

This document describes the E2E testing methodology, custom architecture, and feature coverage inventory for the Lumin tree hole platform.

---

## 1. Testing Methodology

Lumin runs in a strictly offline (`CODE_ONLY` network mode) environment. Because downloading browser binaries or the `@playwright/test` library is restricted, we utilize a **Custom Node-based E2E Integration Runner**.

### Core Principles
- **Black-box API Integration**: Tests interact directly with the Next.js local dev server over HTTP to test endpoints, headers, and authentication.
- **Session State Management**: A custom client agent preserves cookies (`th_token` session token) automatically, simulating authentic user sessions.
- **Hardware/Browser API Mocks**: Web Audio API (`AudioContext`, filters, oscillators) is mocked globally to trace connecting nodes and verify correct parameter synthesis (e.g. lowpass cutoff for wave aesthetics).
- **Graceful Cleanup**: The runner automatically manages the lifecycle of the local Next.js dev server, freeing port 3000 on Windows.
- **Behavior-Driven Checks**: Test cases verify critical backend gating, social updates, and visual/audio aesthetic configs.

---

## 2. E2E Testing Architecture

The runner starts the server, executes the test suites, and terminates cleanly.

```
                  +--------------------------------+
                  |       tests/e2e/runner.js      |
                  +---------------+----------------+
                                  |
            +---------------------+---------------------+
            | (Spawns & Polls)                          | (Requires & Runs)
            v                                           v
+-----------------------+                    +-----------------------+
|  npm run dev (Port 3) |                    | tests/e2e/tier1.test  |
+-----------+-----------+                    +-----------+-----------+
            ^                                            |
            | (HTTP Requests with Cookie Session)         | (Mock Assertions)
            +--------------------------------------------+
```

### Server Management
- The dev server is spawned using `child_process.spawn`.
- Before and after execution, Windows `netstat` is queried to find and terminate any process listening on port 3000, avoiding orphan server processes.

### Web Audio & UI Mocking
- The runner injects a mock `AudioContext` and nodes (`GainNode`, `OscillatorNode`, `BiquadFilterNode`) on the global object.
- Tests instantiate these mock objects to verify that:
  - Ambient noise lowpass cutoffs are set around 100-300Hz (Water theme) to reduce harsh hiss.
  - Active audio frequencies match the correct musical note scales on theme switch.
- For UI states, pages are fetched as HTML, and elements (canvas, inputs, forms) are validated using selectors.

---

## 3. Feature Inventory (F1 - F11)

Lumin contains 11 core features. The Tier 1 test suite implements 5 test cases per feature (55 test cases total).

### F1: User Authentication & Registration
- **Description**: Handles registration, login, logout, password resets, and session verification.
- **Requirements Covered**: Session establishment and security token validation.

### F2: Anonymous Post Creation & Client Encryption
- **Description**: Publishes posts, supporting tags, anonymous/guest nicknames, client-side encryption, and language detection.
- **Requirements Covered**: Client-side cryptography validation and guest posting rules.

### F3: Post Feed & Filter/Recommendation
- **Description**: Displays the home screen feed, supporting pagination, category filtering, tag filtering, language filtering, and recommendation engines.
- **Requirements Covered**: Decryption of posts on read.

### F4: Empathy ("Me Too") System & Tiers
- **Description**: Adds/removes Me Too reactions to posts, supporting guest reaction tracking and visual intensity levels based on reaction count.
- **Requirements Covered**: Post interaction limits and active visual state changes.

### F5: Comment & Nested Reply System
- **Description**: Supports comments, replies to comments, and counting reply levels.
- **Requirements Covered**: Interactive social feeds.

### F6: Privacy Controls & Comment Gating
- **Description**: Allows authors to toggle comments entirely and restrict commenting to registered members only.
- **Requirements Covered**: R1 & R2 comments gating. Returns `403` or `422` when conditions are breached.

### F7: Social Notifications & Message Box
- **Description**: Dispatches comment notifications and displays them in a dedicated Message Box.
- **Requirements Covered**: R1 Message Box UI and unread counts.

### F8: Nickname Customization & Zodiac Calculation
- **Description**: Updates profile details (nickname, bio, birthday) and calculates zodiac/cusp alignments.
- **Requirements Covered**: R2 Nickname changes, ensuring future posts display the updated nickname.

### F9: User Blocking System
- **Description**: Blocks specific users to hide their posts/comments and mutual communication.
- **Requirements Covered**: Anti-harassment controls.

### F10: Web Audio Ambient Sounds & Interactive Audio
- **Description**: Generates background noise for Water, Campfire, and Space themes.
- **Requirements Covered**: R3 Web Audio parameter tuning (e.g. lowpass filters for wave rumble, crackles, mute/gain).

### F11: UI Themes, Color Customization & Transitions
- **Description**: Theme selection toggles, time-based automatic theme changes, color customizers, and canvas animations.
- **Requirements Covered**: R3 water ripple transitions, color pickers, and musical scale triggers.
