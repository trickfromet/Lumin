# Scope: E2E Testing Track

## Architecture
- Opaque-box E2E testing framework, requirement-driven, executing against local Next.js environment.
- Test runner: We will use Playwright if possible. If Playwright or browser binaries are not installable offline, the Worker will implement a robust Node-based HTTP-client and virtual-DOM integration test runner (`npm run test:e2e`) to verify the REST APIs, client-side scripts, and pages via server-rendered HTML and client API interactions.
- Directory layout:
  - `tests/e2e/` for test scripts.
  - `playwright.config.ts` or custom E2E runner.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Infra & Tier 1 | Setup E2E test runner, configuration, and Tier 1 tests (Feature Coverage: >=5 tests per feature for R1, R2, R3) | None | PLANNED |
| 2 | Tier 2 (Boundary) | Write Tier 2 tests (Boundary & Edge Cases: >=5 tests per feature for R1, R2, R3) | M1 | PLANNED |
| 3 | Tier 3 (Cross-Feature) | Write Tier 3 tests (Cross-Feature Combinations: pairwise coverage) | M2 | PLANNED |
| 4 | Tier 4 (Real-World) | Write Tier 4 tests (Real-World Application Scenarios: >=5 workloads) | M3 | PLANNED |
| 5 | Publish TEST_READY.md | Run final E2E test suite checks and publish TEST_READY.md | M4 | PLANNED |

## Interface Contracts
- API contract definitions from PROJECT.md will be verified by the E2E tests:
  - Post comments toggles: `allowComments`, `allowStrangerComments` (boolean).
  - API commenting restrictions (returning 403 or 422).
  - Nickname updates under `PATCH /api/users/me` and subsequent posts nickname alignment.
  - Message box notifications and "My Posts" list endpoint checks.
  - Sensory transitions and audio enhancements verification hooks/selectors.
