import { defineConfig, devices } from "@playwright/test";

const authFile = "playwright/.auth/user.json";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const usesExternalServer = process.env.PLAYWRIGHT_BASE_URL !== undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // Run tests serially against the dev server — parallel workers overwhelm
  // Next.js dev mode and cause intermittent auth-spinner timeouts.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
    actionTimeout: 15_000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // ── Auth capture ─────────────────────────────────────────────────────────
    // Opens a real headed browser so you can sign in with 1Password.
    // Run once with: pnpm test:e2e:login
    // Saves the Supabase session to playwright/.auth/user.json (gitignored).
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { headless: false },
    },

    // ── Demo-mode suite (default) ─────────────────────────────────────────────
    // No credentials needed — always works. Run with: pnpm test:e2e
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // IndexedDB and editor-lifecycle coverage on WebKit stays narrowly scoped
    // so the default Chromium demo suite remains the primary broad gate.
    {
      name: "webkit-lifecycle",
      testMatch: /14-collaboration-lifecycle\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },

    // ── Authenticated suite ───────────────────────────────────────────────────
    // Uses the real session saved by pnpm test:e2e:login.
    // Run with: pnpm test:e2e:authenticated
    // Requires playwright/.auth/user.json — run pnpm test:e2e:login first.
    {
      name: "authenticated",
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
  webServer: {
    // CI runs against a production build (next start) for realistic perf numbers.
    // Local dev uses the hot-reloading dev server as before.
    command: process.env.CI
      ? "pnpm --filter @workspace/next-app run start"
      : "pnpm --filter @workspace/next-app run dev",
    url: baseURL,
    reuseExistingServer: usesExternalServer || !process.env.CI,
    timeout: 120_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
