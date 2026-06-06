# Implementation Plan - Student Anonymous Tree Hole Platform

This plan outlines the concrete, step-by-step strategy for managing and verifying the implementation of the new features.

## Step 1: E2E Testing Track Setup (Milestone 1)
- **Objective**: Establish the requirement-driven, opaque-box E2E test suite.
- **Tasks**:
  1. Define test cases covering Tiers 1-4.
  2. Implement E2E test scripts / runner that execute against local APIs and frontend logic.
  3. Publish `TEST_READY.md` when coverage requirements are satisfied.
- **Verification**: Run the test runner and verify it reports all test cases (currently failing or stubbed).

## Step 2: Privacy Controls & Database (Milestone 2)
- **Objective**: Implement toggles for comments/stranger replies, update DB schema, and enforce comment restrictions.
- **Tasks**:
  1. Add `allowComments` and `allowStrangerComments` columns to the database schema (`schema.prisma`).
  2. Run migration to apply schema changes to SQLite.
  3. Update `/api/posts` (GET/POST) and `/api/posts/[id]` (GET) to process and return these fields.
  4. Implement validation inside `POST /api/posts/[id]/comments` to reject unauthorized comments/replies with 403 or 422.
- **Verification**: Run Milestone 2 unit tests/E2E tests to check compliance.

## Step 3: Social & User Customization (Milestone 3)
- **Objective**: Add Emoji pickers, Message Box UI, "My Posts" view, and Profile Nickname editing.
- **Tasks**:
  1. Add UI switches for privacy controls on post creation.
  2. Add input field for nickname updates on the user profile, sending `PATCH /api/users/me` request.
  3. Integrate Emoji picker/quick-entry panel on post publishing and comment posting.
  4. Create a dedicated Message Box UI to query `/api/notifications` and display comment/reply notifications. Show unread indicators and mark as read upon viewing.
  5. Implement "My Posts" page/view which queries `/api/posts?userId=current_user_id` and displays the posts.
- **Verification**: Verify visual appearance and database updates when editing nicknames, posting, and receiving comments.

## Step 4: Visual & Audio Aesthetics (Milestone 4)
- **Objective**: Add water ripple transition, optimize Web Audio, add note trigger on theme switch, and customize theme colors.
- **Tasks**:
  1. Create water ripple transition effect on canvas/CSS when entering a tree hole.
  2. Adjust Web Audio synthesis parameters in `audio.ts` to reduce hiss noise (water sounds) and boost campfire effects.
  3. Play distinct notes (pitch/tone) depending on the selected theme in `audio.ts`.
  4. Implement custom element color pickers/predefined palettes for theme center elements, persisting it in state.
- **Verification**: Verify transition rendering, theme switching notes, custom color persistence, and listen/analyze synthesized audio frequency content.

## Step 5: Integration & Hardening (Milestone 5)
- **Objective**: Verify that 100% of tests pass and perform adversarial code path verification.
- **Tasks**:
  1. Execute E2E test suite (Tiers 1-4) on the complete system.
  2. Perform Tier 5 white-box coverage hardening (Challenger scans codebase for untested paths, generates tests, Worker fixes bugs).
- **Verification**: 100% test completion and Forensic Auditor cleanup verification.
