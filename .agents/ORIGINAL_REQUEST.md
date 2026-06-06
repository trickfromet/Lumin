# Original User Request

## Initial Request — 2026-06-06T00:06:50Z

An anonymous tree hole platform designed primarily for students to share worries and find empathy without feeling like a burden, featuring privacy-focused social interactions and immersive sensory aesthetics.

Working directory: E:\Desktop\Lumin
Integrity mode: development

## Requirements

### R1. Core Social Features & Settings
- Add an Emoji picker/quick-entry entrance for both post publishing and comment posting.
- Implement a dedicated Message Box UI/panel to display notifications of replies/comments received on the current user's posts.
- Implement a "My Posts" view/page listing all posts created by the current user.

### R2. Privacy Controls & Account Customization
- Modify database schema and APIs to support toggling comment status on posts:
  - "Allow Comments" (allow/disallow comments entirely).
  - "Accept Stranger Replies" (allow/disallow replies from unregistered guest users).
- Implement toggles for the above two settings during post creation.
- Add a nickname modification feature for registered users, updating their profile nickname.

### R3. Visual & Audio Aesthetics (Sensory Experience)
- Add a water ripple transition effect when entering a tree hole.
- Optimize the Web Audio synthesis parameters in `audio.ts`:
  - Reduce harsh noise in the water ambient sound, making it smooth and comfortable.
  - Enhance the campfire crackle/rumble touch feedback sounds and background ambiance.
- Assign a distinct musical note (pitch/tone) corresponding to each tree hole theme, played when selecting/switching themes.
- Implement a theme center element color customization feature.

## Acceptance Criteria

### Social & Privacy Features
- [ ] Post creation page has functional toggles for "Allow Comments" and "Accept Stranger Replies".
- [ ] Comment API returns a `403` or `422` error if a user attempts to comment on a post where `allowComments` is false, or if a guest/anonymous user attempts to reply when `allowStrangerComments` is false.
- [ ] Message Box successfully loads and displays recent notifications/replies, marked as read upon viewing.
- [ ] Nickname modification updates the User's record in the SQLite database, and subsequently published posts show the new nickname.
- [ ] "My Posts" page fetches and displays posts matching the current logged-in user's ID.

### Audio-Visual Experience
- [ ] Transitioning into a tree hole renders a CSS or canvas-based water ripple transition animation.
- [ ] Audio synthesis for water ambient sound uses a lower-frequency bandpass or lowpass filter (e.g. peak around 100-300Hz, rolling off high frequencies) to minimize white noise hiss.
- [ ] Clicking on themes plays different synthesized notes (musical chord/scale steps matching the visual theme).
- [ ] Theme center element color can be changed dynamically via color pickers or preselected palette buttons, and is persisted/reflected in the visual state.
