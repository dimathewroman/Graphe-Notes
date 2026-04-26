import { defineConfig, devices } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // Run tests serially against the dev server — parallel workers overwhelm
  // Next.js dev mode and cause intermittent auth-spinner timeouts.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
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
    command: "pnpm --filter @workspace/next-app run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
