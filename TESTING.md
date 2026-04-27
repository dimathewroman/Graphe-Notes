# Testing

Reference for the Graphe Notes test suite. Read this before writing or modifying tests, or before submitting a PR that changes behavior covered by existing tests.

---

## Overview

Graphe Notes uses **Playwright** for E2E testing. There are no unit tests (no Jest or Vitest). The pre-push typecheck hook serves as the build-gate equivalent of a unit test suite — it catches type errors, import mismatches, and broken API signatures before code reaches CI.

Test location: `artifacts/next-app/e2e/`

---

## Running Tests Locally

### Default (demo mode — no credentials needed)

```bash
# Terminal 1: start the dev server
pnpm --filter @workspace/next-app run dev

# Terminal 2: run the full E2E suite
pnpm --filter @workspace/next-app run test:e2e

# Run a single spec
pnpm --filter @workspace/next-app exec playwright test 02-notes.spec.ts --project=chromium

# Run with UI
pnpm --filter @workspace/next-app exec playwright test --ui
```

Tests run against `http://localhost:3000`. The dev server must be running first — Playwright does not start it for you in local mode.

### Viewing results

```bash
# Open the HTML report after a run
pnpm --filter @workspace/next-app exec playwright show-report
```

---

## Playwright Projects

The config (`artifacts/next-app/playwright.config.ts`) defines three projects:

| Project | When to use | Auth required |
|---|---|---|
| `chromium` | Default — smoke tests, CI, most local dev | No — demo mode |
| `authenticated` | Full-flow tests against real Supabase | Yes — see below |
| `setup` | One-time auth session capture | Yes — interactive |

### Demo mode (chromium)

The default project. All tests use `enterDemoMode(page)` from `e2e/helpers.ts` to bypass login. This helper clicks "Enter demo mode" and waits for the demo banner to appear.

Demo mode tests never call authenticated API endpoints — mutations patch the React Query cache in-memory. Tests are deterministic and work on any machine without credentials.

### Authenticated mode

Requires `playwright/.auth/user.json` — a saved Supabase session. To create it:

```bash
pnpm --filter @workspace/next-app run test:e2e:login
# Opens a headed browser. Sign in with your test account.
# The session is saved to playwright/.auth/user.json (gitignored).
```

Then run authenticated tests:

```bash
pnpm --filter @workspace/next-app run test:e2e:authenticated
```

Requires `TEST_EMAIL` and `TEST_PASSWORD` in `.env` (see `.env.example`). The test account credentials are in 1Password.

---

## Test Files

| File | What it covers |
|---|---|
| `01-app-loads.spec.ts` | Login screen renders; demo mode boots; app shell visible |
| `02-notes.spec.ts` | Create, open, edit, delete, search notes |
| `03-quick-bits.spec.ts` | Quick Bits list load, creation, navigation |
| `04-vault.spec.ts` | Vault setup, PIN entry, vaulting/unvaulting notes |
| `05-micro-interactions.spec.ts` | Hover states, press feedback, panel toggles |
| `06-templates.spec.ts` | Template picker open/apply; save-as-template flow |
| `07-onboarding.spec.ts` | First-run onboarding modal steps |
| `08-performance.spec.ts` | Interaction timing baselines; threshold enforcement |
| `09-visual.spec.ts` | Visual regression snapshots |

All tests use `data-testid` attributes for selectors — never CSS classes or element structure.

Tests run serially (`workers: 1`). The Next.js dev server cannot reliably handle concurrent workers.

---

## Writing New Tests

### Setup

All demo-mode tests should start with `enterDemoMode(page)` from `e2e/helpers.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test("my new test", async ({ page }) => {
  await enterDemoMode(page);
  // now on All Notes with demo data loaded
});
```

### Selectors

Always use `data-testid`:

```tsx
// In the component
<button data-testid="new-note-button">New Note</button>

// In the test
await page.click('[data-testid="new-note-button"]');
```

Never select by CSS class or element type — these are implementation details that change without warning.

### What to test

Focus on user-visible outcomes, not implementation:

```typescript
// Good — tests what the user sees
await expect(page.locator('[data-testid="note-title"]')).toBeVisible();

// Avoid — tests internal structure
await expect(page.locator('.NoteShell__titleInput')).toBeVisible();
```

### Viewports

Playwright defaults to 1280×800. For viewport-specific behavior, use `page.setViewportSize`:

```typescript
await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
await page.setViewportSize({ width: 768, height: 1024 }); // iPad
```

When adding new UI that behaves differently at mobile widths, add viewport-specific assertions.

---

## Visual Regression Testing

`09-visual.spec.ts` captures screenshots and compares against committed baselines.

Snapshots are stored in `e2e/<spec-name>-snapshots/` and committed to the repo.

### Updating baselines

When you intentionally change the appearance of a component:

```bash
# Update all snapshots (rewrites baseline files)
pnpm --filter @workspace/next-app exec playwright test 09-visual.spec.ts --update-snapshots

# Commit the updated snapshot files
git add e2e/*-snapshots/
```

> **Important:** CI runs on Linux and captures Linux snapshots. Local macOS runs generate different PNG bytes even for identical layouts. The `--update-snapshots=missing` flag in CI only adds new snapshots without overwriting existing ones. If a visual test fails in CI, download the CI artifact, inspect the diff, and update baselines by running with `--update-snapshots` locally on a Linux machine or in CI.

---

## Performance Testing

`08-performance.spec.ts` measures wall-clock interaction timings and compares against baseline files.

Full documentation: [PERFORMANCE.md](PERFORMANCE.md)

Quick reference:

```bash
# Run the perf suite against the local baseline
pnpm --filter @workspace/next-app exec playwright test 08-performance.spec.ts --project=chromium

# Use the CI baseline locally
PERF_BASELINE_FILE=$(pwd)/artifacts/next-app/e2e/perf-baseline-ci.json \
  pnpm --filter @workspace/next-app exec playwright test 08-performance.spec.ts --project=chromium
```

On the first run after deleting a baseline file, the suite records new baseline values and exits without enforcing thresholds. On subsequent runs it compares against the recorded baseline.

Thresholds: ≥1.5× baseline → warning annotation; ≥2.5× baseline → test failure.

---

## CI Pipeline

The CI workflow is `.github/workflows/e2e.yml`. Two parallel jobs run on every PR to `master`.

### Job 1: Typecheck

1. Install dependencies
2. Run `pnpm run typecheck` (all workspaces)
3. Run `pnpm --filter @workspace/next-app run build` (verifies the production build compiles)

### Job 2: E2E Tests

1. Install dependencies + Playwright chromium browser
2. Copy `.env.example` to `.env` (placeholder values only — demo mode, no real credentials)
3. Build production bundle (`next build`)
4. Start production server (`next start`) — tests run against the prod build, not dev
5. Run all `chromium` project tests with `--update-snapshots=missing`
6. Post a performance table comment to the PR (updates in place on reruns)
7. Upload artifacts: playwright-report (7d), perf-report (30d), visual-snapshots (30d), perf-baseline-ci (30d)

CI uses production build specifically for realistic performance numbers. Bold-toggle timing is actually faster in production (synchronous DOM ops benefit from compiled JS).

### CI env vars

CI sets placeholder values for all env vars so Next.js starts without crashing. Tests run in demo mode — no Supabase connection, no real AI keys. The `NEXT_PUBLIC_POSTHOG_KEY` and Sentry DSN are also set to placeholders so telemetry is suppressed during tests.

---

## Auth Session Security

`playwright/.auth/user.json` contains a real Supabase session token. It is:

- Gitignored — never committed to the repo
- Valid for the duration of the Supabase session (typically days to weeks)
- Scoped to the test account only

Store credentials and the session file in 1Password, not in Slack or email.

---

## macOS vs Windows

- Playwright itself works identically on macOS, Linux, and Windows
- The git hooks (`pre-push`, `post-merge`) use bash syntax — Windows users need Git Bash or WSL
- Visual regression snapshots captured on macOS differ at the byte level from Linux snapshots — CI baselines are generated on Linux (ubuntu-latest)
- Performance baseline numbers differ by OS and hardware — local `perf-baseline.json` (macOS) is separate from CI `perf-baseline-ci.json` (Linux runner)
